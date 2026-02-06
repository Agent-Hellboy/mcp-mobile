import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { HttpTransport, McpClient, TokenAuthProvider } from '@mcp/core';

export type ServerConfig = {
  id: string;
  name: string;
  serverUrl: string;
  endpoint: string;
  token?: string;
  defaultTool: string;
  ready?: boolean;
};

function serverKey(server: ServerConfig | Omit<ServerConfig, 'id' | 'ready'>): string {
  const url = (server.serverUrl ?? '').replace(/\/+$/, '') || '';
  const ep = server.endpoint ?? '/mcp';
  const path = ep.startsWith('/') ? ep : `/${ep}`;
  const token = server.token ?? '';
  return `${url}|${path}|${token}`;
}

type McpContextValue = {
  servers: ServerConfig[];
  activeServerId: string;
  setActiveServerId: (id: string) => void;
  addServer: (server: Omit<ServerConfig, 'id' | 'ready'>) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, update: Partial<ServerConfig>) => void;
  getOrCreateClient: (server: ServerConfig | Omit<ServerConfig, 'id' | 'ready'>) => Promise<McpClient>;
  provider: 'openai' | 'anthropic';
  setProvider: (provider: 'openai' | 'anthropic') => void;
  openaiModel: string;
  anthropicModel: string;
  setOpenaiModel: (model: string) => void;
  setAnthropicModel: (model: string) => void;
  openaiKey: string;
  anthropicKey: string;
  setOpenaiKey: (key: string) => void;
  setAnthropicKey: (key: string) => void;
};

const randomId = () => `srv_${Math.random().toString(36).slice(2)}`;

const defaultServers: ServerConfig[] = [
  {
    id: 'default',
    name: 'Primary MCP',
    serverUrl: 'https://your-mcp-server.example',
    endpoint: '/mcp',
    token: '',
    defaultTool: 'chat',
    ready: false,
  },
];

const McpContext = createContext<McpContextValue | null>(null);

export function McpProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<ServerConfig[]>(defaultServers);
  const [activeServerId, setActiveServerId] = useState(defaultServers[0]?.id ?? '');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [openaiModel, setOpenaiModel] = useState('gpt-4.1-mini');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet-20241022');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');


  const addServer = useCallback((server: Omit<ServerConfig, 'id' | 'ready'>) => {
    setServers((prev) => [
      ...prev,
      {
        ...server,
        id: randomId(),
        ready: false,
      },
    ]);
  }, []);

  const clientCacheRef = useRef<Record<string, McpClient>>({});
  const initPromiseRef = useRef<Record<string, Promise<McpClient>>>({});

  const getOrCreateClient = useCallback(
    async (server: ServerConfig | Omit<ServerConfig, 'id' | 'ready'>): Promise<McpClient> => {
      const key = serverKey(server);
      let client = clientCacheRef.current[key];
      if (client) return client;
      let initPromise = initPromiseRef.current[key];
      if (!initPromise) {
        initPromise = (async () => {
          try {
            const authProvider = new TokenAuthProvider(server.token ?? '');
            const transport = new HttpTransport({
              serverUrl: server.serverUrl,
              endpoint: server.endpoint ?? '/mcp',
              authProvider,
            });
            const c = new McpClient({ transport });
            await c.initialize({ name: 'mcp-mobile', version: '0.1.0' });
            clientCacheRef.current[key] = c;
            return c;
          } finally {
            delete initPromiseRef.current[key];
          }
        })();
        initPromiseRef.current[key] = initPromise;
      }
      return initPromise;
    },
    [],
  );

  const removeServer = useCallback((id: string) => {
    setServers((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed) {
        const key = serverKey(removed);
        const cached = clientCacheRef.current[key];
        if (cached?.close) cached.close().catch(() => {});
        delete clientCacheRef.current[key];
        delete initPromiseRef.current[key];
      }
      return prev.filter((item) => item.id !== id);
    });
    setActiveServerId((prev) => (prev === id ? '' : prev));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'background') return;
      const cache = clientCacheRef.current;
      const keys = Object.keys(cache);
      keys.forEach((key) => {
        const client = cache[key];
        if (client?.close) client.close().catch(() => {});
      });
      clientCacheRef.current = {};
      initPromiseRef.current = {};
    });
    return () => subscription.remove();
  }, []);

  const updateServer = useCallback((id: string, update: Partial<ServerConfig>) => {
    setServers((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...update };
        const oldKey = serverKey(item);
        const newKey = serverKey(updated);
        if (oldKey !== newKey) {
          const cached = clientCacheRef.current[oldKey];
          if (cached?.close) cached.close().catch(() => {});
          delete clientCacheRef.current[oldKey];
          delete initPromiseRef.current[oldKey];
        }
        return updated;
      }),
    );
  }, []);

  const setOpenaiKeySafe = useCallback((key: string) => {
    setOpenaiKey(key);
  }, []);

  const setAnthropicKeySafe = useCallback((key: string) => {
    setAnthropicKey(key);
  }, []);

  const value = useMemo(
    () => ({
      servers,
      activeServerId,
      setActiveServerId,
      addServer,
      removeServer,
      updateServer,
      getOrCreateClient,
      provider,
      setProvider,
      openaiModel,
      anthropicModel,
      setOpenaiModel,
      setAnthropicModel,
      openaiKey,
      anthropicKey,
      setOpenaiKey: setOpenaiKeySafe,
      setAnthropicKey: setAnthropicKeySafe,
    }),
    [
      servers,
      activeServerId,
      addServer,
      removeServer,
      updateServer,
      getOrCreateClient,
      provider,
      openaiModel,
      anthropicModel,
      openaiKey,
      anthropicKey,
      setOpenaiKeySafe,
      setAnthropicKeySafe,
    ],
  );

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}

export function useMcp() {
  const ctx = useContext(McpContext);
  if (!ctx) throw new Error('useMcp must be used within McpProvider');
  return ctx;
}
