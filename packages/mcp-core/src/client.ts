import type {
  Logger,
  OfflineOptions,
  RequestOptions,
  StreamOptions,
  ToolCall,
  UploadOptions,
  FileLike,
} from './types';
import { OfflineQueue } from './queue';
import type { Transport } from './transport';

export type McpClientOptions = {
  transport: Transport;
  logger?: Logger;
  offline?: OfflineOptions;
};

export class McpClient {
  private transport: Transport;
  private logger?: Logger;
  private queue?: OfflineQueue;
  private initialized = false;
  private initResult?: unknown;
  private initPromise?: Promise<unknown>;
  private initGeneration = 0;

  constructor(options: McpClientOptions) {
    this.transport = options.transport;
    this.logger = options.logger;
    this.queue = options.offline ? new OfflineQueue(options.offline) : undefined;
  }

  async initialize(clientInfo: Record<string, unknown> = {}): Promise<unknown> {
    if (this.initialized) return this.initResult;
    if (this.initPromise) return this.initPromise;
    const initRunId = ++this.initGeneration;
    // Streamable HTTP spec: protocolVersion, capabilities, clientInfo (name + version only)
    const params = {
      protocolVersion: '2024-11-05',
      capabilities: {} as Record<string, unknown>,
      clientInfo: {
        name: (clientInfo.name as string) ?? 'mcp-client',
        version: (clientInfo.version as string) ?? '0.1.0',
      },
    };
    this.initPromise = this.request('initialize', params)
      .then((result) => {
        if (initRunId === this.initGeneration) {
          this.initialized = true;
          this.initResult = result;
        }
        return result;
      })
      .catch((error) => {
        if (initRunId === this.initGeneration) {
          this.initialized = false;
          this.initResult = undefined;
        }
        throw error;
      })
      .finally(() => {
        if (initRunId === this.initGeneration) {
          this.initPromise = undefined;
        }
      });
    return this.initPromise;
  }

  async listTools(): Promise<unknown> {
    return this.request('tools/list');
  }

  async callTool(call: ToolCall): Promise<unknown> {
    return this.request('tools/call', call);
  }

  async request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T> {
    try {
      if (this.queue) {
        const online = await this.queue.isOnline();
        if (!online) {
          await this.queue.enqueue(method, params);
          return { queued: true } as T;
        }
      }
      return await this.transport.request<T>(method, params, options);
    } catch (error) {
      if (this.queue) {
        await this.queue.enqueue(method, params);
        this.logger?.warn?.('Request queued due to error', { method, error });
        return { queued: true } as T;
      }
      throw error;
    }
  }

  async *stream<T>(method: string, params?: unknown, options?: StreamOptions): AsyncIterable<T> {
    yield* this.transport.stream<T>(method, params, options);
  }

  async upload<T>(file: FileLike, options?: UploadOptions): Promise<T> {
    if (!this.transport.upload) {
      throw new Error('Transport does not support uploads.');
    }
    return this.transport.upload<T>(file, options);
  }

  async flushQueue(): Promise<void> {
    if (!this.queue) return;
    await this.queue.flush(async (item) => {
      await this.transport.request(item.method, item.params);
    });
  }

  async close(): Promise<void> {
    this.initGeneration += 1;
    if ('close' in this.transport && typeof this.transport.close === 'function') {
      await (this.transport as { close: () => Promise<void> }).close();
    }
    this.initialized = false;
    this.initResult = undefined;
    this.initPromise = undefined;
  }
}
