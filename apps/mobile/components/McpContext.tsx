import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ServerConfig = {
  id: string;
  name: string;
  serverUrl: string;
  endpoint: string;
  token?: string;
  defaultTool: string;
  ready?: boolean;
};

type McpContextValue = {
  servers: ServerConfig[];
  activeServerId: string;
  setActiveServerId: (id: string) => void;
  addServer: (server: Omit<ServerConfig, 'id' | 'ready'>) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, update: Partial<ServerConfig>) => void;
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

  const removeServer = useCallback((id: string) => {
    setServers((prev) => prev.filter((item) => item.id !== id));
    setActiveServerId((prev) => (prev === id ? '' : prev));
  }, []);

  const updateServer = useCallback((id: string, update: Partial<ServerConfig>) => {
    setServers((prev) => prev.map((item) => (item.id === id ? { ...item, ...update } : item)));
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
