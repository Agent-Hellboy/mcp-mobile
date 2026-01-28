import type { OfflineOptions, QueuedRequest, QueueStorage } from './types';

const randomId = () => `q_${Math.random().toString(36).slice(2)}`;

export class InMemoryQueueStorage implements QueueStorage {
  private items: QueuedRequest[] = [];

  async getAll(): Promise<QueuedRequest[]> {
    return [...this.items];
  }

  async add(item: QueuedRequest): Promise<void> {
    this.items.push(item);
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

export class OfflineQueue {
  private options: OfflineOptions;

  constructor(options: OfflineOptions) {
    this.options = options;
  }

  async enqueue(method: string, params?: unknown): Promise<QueuedRequest> {
    const items = await this.options.storage.getAll();
    if (this.options.maxQueueSize && items.length >= this.options.maxQueueSize) {
      const oldest = items[0];
      if (oldest) await this.options.storage.remove(oldest.id);
    }

    const item: QueuedRequest = {
      id: randomId(),
      method,
      params,
      createdAt: Date.now(),
    };
    await this.options.storage.add(item);
    this.options.onEnqueue?.(item);
    return item;
  }

  async flush(sender: (item: QueuedRequest) => Promise<void>): Promise<void> {
    const items = await this.options.storage.getAll();
    for (const item of items) {
      await sender(item);
      await this.options.storage.remove(item.id);
    }
  }

  async isOnline(): Promise<boolean> {
    if (!this.options.isOnline) return true;
    return await this.options.isOnline();
  }
}
