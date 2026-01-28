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

  constructor(options: McpClientOptions) {
    this.transport = options.transport;
    this.logger = options.logger;
    this.queue = options.offline ? new OfflineQueue(options.offline) : undefined;
  }

  async initialize(clientInfo: Record<string, unknown> = {}): Promise<unknown> {
    return this.request('initialize', { clientInfo });
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
}
