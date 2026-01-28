export type JsonRpcId = string | number | null;

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse<T = unknown> = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: T;
  error?: JsonRpcError;
};

export type HeadersMap = Record<string, string>;

export type Logger = {
  debug?: (message: string, meta?: unknown) => void;
  info?: (message: string, meta?: unknown) => void;
  warn?: (message: string, meta?: unknown) => void;
  error?: (message: string, meta?: unknown) => void;
};

export type RetryPolicy = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: (error: unknown, attempt: number) => boolean;
};

export type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type StreamOptions = {
  signal?: AbortSignal;
};

export type AuthProvider = {
  getHeaders: () => Promise<HeadersMap> | HeadersMap;
  refresh?: () => Promise<void>;
};

export type FileLike = {
  name: string;
  type?: string;
  uri?: string;
  data?: Blob | ArrayBuffer | Uint8Array;
};

export type UploadOptions = {
  fields?: Record<string, string>;
  path?: string;
};

export type ToolCall = {
  name: string;
  arguments?: Record<string, unknown>;
};

export type QueuedRequest = {
  id: string;
  method: string;
  params?: unknown;
  createdAt: number;
};

export type QueueStorage = {
  getAll: () => Promise<QueuedRequest[]>;
  add: (item: QueuedRequest) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
};

export type OfflineOptions = {
  storage: QueueStorage;
  maxQueueSize?: number;
  isOnline?: () => boolean | Promise<boolean>;
  onEnqueue?: (item: QueuedRequest) => void;
};
