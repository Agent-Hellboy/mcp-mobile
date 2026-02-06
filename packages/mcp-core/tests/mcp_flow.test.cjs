const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const ts = require('typescript');

const useRemote =
  process.env.MCP_FLOW_USE_REMOTE === '1' || process.env.MCP_FLOW_USE_REMOTE === 'true';
const envHost = process.env.MCP_HOST;
const envEndpoint = process.env.MCP_ENDPOINT ?? '/mcp';

const readJson = async (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const createTestServer = async () =>
  new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const { method, url } = req;
      if (url !== '/mcp') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      if (method === 'DELETE') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (method !== 'POST') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }

      let payload;
      try {
        payload = await readJson(req);
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
      }

      const { id, method: rpcMethod, params } = payload ?? {};
      res.setHeader('Content-Type', 'application/json');
      let result;

      if (rpcMethod === 'initialize') {
        res.setHeader('mcp-session-id', 'test-session');
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'mcp-test', version: '0.0.0' },
        };
      } else if (rpcMethod === 'tools/list') {
        result = {
          tools: [
            {
              name: 'echo',
              description: 'Echo tool',
              inputSchema: {
                type: 'object',
                properties: { message: { type: 'string' } },
                required: ['message'],
              },
            },
          ],
        };
      } else if (rpcMethod === 'tools/call') {
        const message = params?.arguments?.message ?? '';
        result = {
          content: [{ type: 'text', text: String(message) }],
        };
      } else {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' },
          }),
        );
        return;
      }

      res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'string' ? 80 : address.port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });

const srcRoot = path.join(__dirname, '..', 'src');

const collectTsFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.isFile() && full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
};

const transpileToTemp = () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-core-test-'));
  const files = collectTsFiles(srcRoot);
  for (const file of files) {
    const rel = path.relative(srcRoot, file);
    const outFile = path.join(outRoot, rel.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const source = fs.readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: file,
    });
    fs.writeFileSync(outFile, output.outputText, 'utf8');
  }
  return outRoot;
};

test('mcp flow using @mcp/core components', async () => {
  const serverBundle = useRemote && envHost ? null : await createTestServer();
  const host = serverBundle ? serverBundle.url : envHost;
  const endpoint = serverBundle ? '/mcp' : envEndpoint;
  const outRoot = transpileToTemp();
  try {
    const { HttpTransport, McpClient } = require(path.join(outRoot, 'index.js'));

    const transport = new HttpTransport({ serverUrl: host, endpoint });
    const client = new McpClient({ transport });

    const initResult = await client.initialize({ name: 'mcp-flow-test', version: '0.1.0' });
    assert.ok(initResult, 'initialize returned empty result');

    const tools = await client.listTools();
    assert.ok(tools, 'tools/list returned empty result');

    const callResult = await client.callTool({ name: 'echo', arguments: { message: 'hi' } });
    assert.ok(callResult, 'tools/call returned empty result');

    await client.close();
  } finally {
    if (serverBundle) {
      await new Promise((resolve) => serverBundle.server.close(resolve));
    }
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
});
