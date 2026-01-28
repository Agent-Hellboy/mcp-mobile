# @mcp/core

Shared TypeScript library for Model Context Protocol (MCP) client functionality.

## Features

- **Transport Layer** - HTTP transport for MCP JSON-RPC communication
- **Authentication** - Token-based authentication provider
- **Client** - High-level MCP client with initialization and tool calling
- **Queue** - Request queue for offline support (pending implementation)
- **Types** - TypeScript types for MCP protocol

## Usage

```typescript
import { McpClient, HttpTransport, TokenAuthProvider } from '@mcp/core';

const authProvider = new TokenAuthProvider('your-token');
const client = new McpClient({
  transport: new HttpTransport({
    serverUrl: 'https://your-mcp-server.com',
    endpoint: '/mcp',
    authProvider,
  }),
});

await client.initialize({
  name: 'my-client',
  version: '1.0.0',
});

const tools = await client.listTools();
const result = await client.callTool({ name: 'tool-name', arguments: {} });
```

## API

### `McpClient`

Main client class for interacting with MCP servers.

### `HttpTransport`

HTTP-based transport implementation for MCP JSON-RPC.

### `TokenAuthProvider`

Authentication provider using bearer tokens.

## License

[Add your license here]
