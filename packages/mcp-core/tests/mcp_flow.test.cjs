const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const host = process.env.MCP_HOST ?? 'http://127.0.0.1:3001';
const endpoint = process.env.MCP_ENDPOINT ?? '/mcp';
const baseUrl = `${host.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

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
  const outRoot = transpileToTemp();
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
});
