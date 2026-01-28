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

export class HttpTransport implements Transport {
  private serverUrl: string;
  private endpoint: string;
  private headers?: HeadersMap;
  private authProvider?: AuthProvider;
  private logger?: Logger;
  private retryPolicy: RetryPolicy;
  private requestId = 1;

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
    const body = JSON.stringify(toJsonRpcRequest(this.requestId++, method, params));

    for (let attempt = 0; attempt <= this.retryPolicy.retries; attempt += 1) {
      try {
        const headers = await buildHeaders(this.headers, this.authProvider);
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
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as JsonRpcResponse<T>;
        return parseJsonRpcResponse(payload);
      } catch (error) {
        const shouldRetry = this.retryPolicy.retryOn?.(error, attempt) ?? true;
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
    const headers = await buildHeaders(this.headers, this.authProvider, {
      Accept: 'text/event-stream',
    });
    const body = JSON.stringify(toJsonRpcRequest(this.requestId++, method, params));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    yield* parseSseStream<T>(response);
  }

  async upload<T>(file: FileLike, options?: UploadOptions): Promise<T> {
    const endpoint = options?.path ?? '/files';
    const url = `${this.serverUrl}${endpoint}`;
    const headers = await buildUploadHeaders(this.headers, this.authProvider);

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

    return (await response.json()) as T;
  }
}
