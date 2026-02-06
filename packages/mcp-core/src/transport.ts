import type {
  AuthProvider,
  HeadersMap,
  JsonRpcRequest,
  JsonRpcResponse,
  Logger,
  RequestOptions,
  RetryPolicy,
  StreamOptions,
  UploadOptions,
  FileLike,
} from './types';

export type TransportRequestOptions = RequestOptions & {
  endpoint?: string;
};

export type TransportStreamOptions = StreamOptions & {
  endpoint?: string;
};

export interface Transport {
  request<T = unknown>(method: string, params?: unknown, options?: TransportRequestOptions): Promise<T>;
  stream<T = unknown>(method: string, params?: unknown, options?: TransportStreamOptions): AsyncIterable<T>;
  upload?<T = unknown>(file: FileLike, options?: UploadOptions): Promise<T>;
  close?(): Promise<void>;
}

export type HttpTransportOptions = {
  serverUrl: string;
  endpoint?: string;
  headers?: HeadersMap;
  authProvider?: AuthProvider;
  logger?: Logger;
  retryPolicy?: RetryPolicy;
};

const defaultRetryPolicy: RetryPolicy = {
  retries: 2,
  baseDelayMs: 300,
  maxDelayMs: 2000,
  retryOn: () => true,
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = async (
  base: HeadersMap | undefined,
  authProvider: AuthProvider | undefined,
  extra?: HeadersMap,
) => {
  const authHeaders = authProvider ? await authProvider.getHeaders() : {};
  return {
    'Content-Type': 'application/json',
    ...(base ?? {}),
    ...authHeaders,
    ...(extra ?? {}),
  } as HeadersMap;
};

const buildUploadHeaders = async (
  base: HeadersMap | undefined,
  authProvider: AuthProvider | undefined,
  extra?: HeadersMap,
) => {
  const authHeaders = authProvider ? await authProvider.getHeaders() : {};
  return {
    ...(base ?? {}),
    ...authHeaders,
    ...(extra ?? {}),
  } as HeadersMap;
};

const redactHeaders = (headers: HeadersMap | undefined) => {
  if (!headers) return undefined;
  const redacted: HeadersMap = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (['authorization', 'cookie', 'set-cookie', 'x-api-key'].includes(lower)) {
      redacted[key] = '[redacted]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

const toJsonRpcRequest = (id: number, method: string, params?: unknown): JsonRpcRequest => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

const parseJsonRpcResponse = <T,>(payload: JsonRpcResponse<T>): T => {
  if (payload.error) {
    const error = new Error(payload.error.message);
    (error as Error & { code?: number; data?: unknown }).code = payload.error.code;
    (error as Error & { code?: number; data?: unknown }).data = payload.error.data;
    throw error;
  }
  return payload.result as T;
};

const parseSseStream = async function* <T>(response: Response): AsyncIterable<T> {
  if (!response.body) {
    throw new Error('Streaming not supported in this runtime.');
  }
  if (typeof TextDecoder === 'undefined') {
    throw new Error('TextDecoder is not available for streaming.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const payload = JSON.parse(data) as JsonRpcResponse<T> | T;
      if ((payload as JsonRpcResponse<T>).jsonrpc) {
        yield parseJsonRpcResponse(payload as JsonRpcResponse<T>);
      } else {
        yield payload as T;
      }
    }
  }
};

const parseSseResponse = async <T>(response: Response): Promise<T> => {
  const decodeSseText = (text: string): T => {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const payload = JSON.parse(data) as JsonRpcResponse<T> | T;
      if ((payload as JsonRpcResponse<T>).jsonrpc) {
        return parseJsonRpcResponse(payload as JsonRpcResponse<T>);
      }
      return payload as T;
    }
    throw new Error('No valid SSE data found in response');
  };

  if (!response.body || typeof TextDecoder === 'undefined') {
    const text = await response.text();
    return decodeSseText(text);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const payload = JSON.parse(data) as JsonRpcResponse<T> | T;
      if ((payload as JsonRpcResponse<T>).jsonrpc) {
        return parseJsonRpcResponse(payload as JsonRpcResponse<T>);
      }
      return payload as T;
    }
  }

  throw new Error('No valid SSE data found in response');
};

export class HttpTransport implements Transport {
  private serverUrl: string;
  private endpoint: string;
  private headers?: HeadersMap;
  private authProvider?: AuthProvider;
  private logger?: Logger;
  private retryPolicy: RetryPolicy;
  private requestId = 1;
  private sessionId?: string;
  private protocolVersion?: string;

  constructor(options: HttpTransportOptions) {
    this.serverUrl = options.serverUrl.replace(/\/$/, '');
    this.endpoint = options.endpoint ?? '/mcp';
    this.headers = options.headers;
    this.authProvider = options.authProvider;
    this.logger = options.logger;
    this.retryPolicy = options.retryPolicy ?? defaultRetryPolicy;
  }

  async request<T>(method: string, params?: unknown, options?: TransportRequestOptions): Promise<T> {
    const endpoint = options?.endpoint ?? this.endpoint;
    const url = `${this.serverUrl}${endpoint}`;
    const requestId = this.requestId++;
    const body = JSON.stringify(toJsonRpcRequest(requestId, method, params));

    for (let attempt = 0; attempt <= this.retryPolicy.retries; attempt += 1) {
      try {
        const startedAt = Date.now();
        const extraHeaders: HeadersMap = {};
        const isInitialize = method === 'initialize';

        // Never include a prior session header when initializing a new session.
        if (isInitialize) {
          if (this.sessionId || this.protocolVersion) {
            this.logger?.warn?.('MCP initialize called with existing session; clearing session headers', {
              sessionId: this.sessionId,
              protocolVersion: this.protocolVersion,
            });
          }
          this.sessionId = undefined;
          this.protocolVersion = undefined;
        } else {
          // Include session headers if we have a session
          if (this.sessionId) {
            extraHeaders['mcp-session-id'] = this.sessionId;
          }
          if (this.protocolVersion) {
            extraHeaders['mcp-protocol-version'] = this.protocolVersion;
          }
        }

        const headers = await buildHeaders(this.headers, this.authProvider, extraHeaders);
        // Streamable HTTP: all POST requests use Accept for JSON + SSE
        headers['Accept'] = 'application/json, text/event-stream';

        this.logger?.debug?.('MCP request start', {
          method,
          requestId,
          url,
          attempt,
          headers: redactHeaders(headers),
          sessionId: this.sessionId,
          protocolVersion: this.protocolVersion,
          hasParams: params !== undefined,
        });

        const controller =
          options?.timeoutMs && !options.signal ? new AbortController() : undefined;
        if (controller && options?.timeoutMs) {
          setTimeout(() => controller.abort(), options.timeoutMs);
        }
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: options?.signal ?? controller?.signal,
        });
        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const text = await response.text();
            if (text) {
              message += `: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`;
            }
          } catch {
            // ignore
          }
          const err = new Error(message) as Error & { status?: number };
          err.status = response.status;
          this.logger?.warn?.('MCP request failed', {
            method,
            requestId,
            url,
            status: response.status,
            elapsedMs: Date.now() - startedAt,
          });
          throw err;
        }

        this.logger?.debug?.('MCP response headers', {
          method,
          requestId,
          url,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          sessionIdHeader: response.headers.get('mcp-session-id') || undefined,
          protocolVersionHeader: response.headers.get('mcp-protocol-version') || undefined,
          elapsedMs: Date.now() - startedAt,
        });

        const contentType = response.headers.get('content-type') || '';
        const isSse = contentType.includes('text/event-stream');

        // Handle initialize response - check if it's SSE or JSON
        if (isInitialize) {
          
          // Extract session ID from response headers
          const sessionIdHeader = response.headers.get('mcp-session-id');
          if (sessionIdHeader) {
            this.sessionId = sessionIdHeader;
            this.logger?.debug?.('MCP session initialized', { sessionId: this.sessionId });
          }

          // Check if response is SSE
          if (isSse) {
            const result = await parseSseResponse<T>(response);
            if (result && typeof result === 'object' && 'protocolVersion' in result) {
              this.protocolVersion = String(result.protocolVersion);
            } else {
              this.protocolVersion = '2024-11-05';
            }
            this.logger?.debug?.('MCP initialize response', {
              method,
              requestId,
              protocolVersion: this.protocolVersion,
            });
            return result;
          }
          
          // JSON response for initialize
          const payload = (await response.json()) as JsonRpcResponse<T>;
          const result = parseJsonRpcResponse(payload);
          if (result && typeof result === 'object' && 'protocolVersion' in result) {
            this.protocolVersion = String(result.protocolVersion);
          } else {
            this.protocolVersion = '2024-11-05';
          }
          this.logger?.debug?.('MCP initialize response', {
            method,
            requestId,
            protocolVersion: this.protocolVersion,
          });
          return result;
        }

        if (isSse) {
          const result = await parseSseResponse<T>(response);
          this.logger?.debug?.('MCP request complete', {
            method,
            requestId,
            elapsedMs: Date.now() - startedAt,
          });
          return result;
        }

        // Regular JSON response
        const payload = (await response.json()) as JsonRpcResponse<T>;
        const result = parseJsonRpcResponse(payload);
        this.logger?.debug?.('MCP request complete', {
          method,
          requestId,
          elapsedMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        // Do not retry on 4xx client errors
        const status = (error as Error & { status?: number }).status;
        const isClientError = status != null && status >= 400 && status < 500;
        const shouldRetry =
          !isClientError && (this.retryPolicy.retryOn?.(error, attempt) ?? true);
        this.logger?.warn?.('MCP request failed', { error, attempt });
        if (!shouldRetry || attempt >= this.retryPolicy.retries) throw error;
        const backoff = Math.min(
          this.retryPolicy.baseDelayMs * 2 ** attempt,
          this.retryPolicy.maxDelayMs,
        );
        await delay(backoff);
      }
    }

    throw new Error('MCP request failed after retries.');
  }

  async *stream<T>(method: string, params?: unknown, options?: TransportStreamOptions): AsyncIterable<T> {
    const endpoint = options?.endpoint ?? this.endpoint;
    const url = `${this.serverUrl}${endpoint}`;
    const extraHeaders: HeadersMap = {
      Accept: 'text/event-stream',
    };
    
    // Include session headers if we have a session
    if (this.sessionId) {
      extraHeaders['mcp-session-id'] = this.sessionId;
    }
    if (this.protocolVersion) {
      extraHeaders['mcp-protocol-version'] = this.protocolVersion;
    }

    const headers = await buildHeaders(this.headers, this.authProvider, extraHeaders);
    const requestId = this.requestId++;
    const body = JSON.stringify(toJsonRpcRequest(requestId, method, params));

    this.logger?.debug?.('MCP stream start', {
      method,
      requestId,
      url,
      headers: redactHeaders(headers),
      sessionId: this.sessionId,
      protocolVersion: this.protocolVersion,
      hasParams: params !== undefined,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    this.logger?.debug?.('MCP stream established', {
      method,
      requestId,
      url,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
    });

    yield* parseSseStream<T>(response);
  }

  async upload<T>(file: FileLike, options?: UploadOptions): Promise<T> {
    const endpoint = options?.path ?? '/files';
    const url = `${this.serverUrl}${endpoint}`;
    const extraHeaders: HeadersMap = {};
    
    // Include session headers if we have a session
    if (this.sessionId) {
      extraHeaders['mcp-session-id'] = this.sessionId;
    }
    if (this.protocolVersion) {
      extraHeaders['mcp-protocol-version'] = this.protocolVersion;
    }

    const headers = await buildUploadHeaders(this.headers, this.authProvider, extraHeaders);
    const startedAt = Date.now();

    this.logger?.debug?.('MCP upload start', {
      url,
      headers: redactHeaders(headers),
      sessionId: this.sessionId,
      protocolVersion: this.protocolVersion,
    });

    const form = new FormData();
    if (options?.fields) {
      for (const [key, value] of Object.entries(options.fields)) {
        form.append(key, value);
      }
    }

    if (file.data) {
      form.append('file', new Blob([file.data]), file.name);
    } else if (file.uri) {
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    } else {
      throw new Error('FileLike must include data or uri.');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    this.logger?.debug?.('MCP upload complete', {
      url,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    });

    return (await response.json()) as T;
  }

  async close(): Promise<void> {
    if (!this.sessionId) {
      this.logger?.warn?.('No active session to close');
      return;
    }

    const endpoint = this.endpoint;
    const url = `${this.serverUrl}${endpoint}`;
    const headers: HeadersMap = {
      ...(this.headers ?? {}),
      'mcp-session-id': this.sessionId,
    };
    
    if (this.protocolVersion) {
      headers['mcp-protocol-version'] = this.protocolVersion;
    }

    // Add auth headers if available
    const authHeaders = this.authProvider ? await this.authProvider.getHeaders() : {};
    Object.assign(headers, authHeaders);

    try {
      this.logger?.debug?.('MCP close start', {
        url,
        sessionId: this.sessionId,
        protocolVersion: this.protocolVersion,
      });
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.logger?.debug?.('MCP session closed', { sessionId: this.sessionId });
      this.sessionId = undefined;
      this.protocolVersion = undefined;
    } catch (error) {
      this.logger?.warn?.('Error closing MCP session', { error });
      // Clear session state even if close fails
      this.sessionId = undefined;
      this.protocolVersion = undefined;
      throw error;
    }
  }
}
