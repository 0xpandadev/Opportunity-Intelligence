const { spawn } = require('node:child_process');

const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('Usage: node scripts/check-mcp-server.cjs <command> [args...]');
  process.exit(2);
}

const child = spawn(argv[0], argv.slice(1), {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
  shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(argv[0])
});
let buffer = '';
let initialized = false;
let listed = false;
let stderr = '';

const send = payload => child.stdin.write(`${JSON.stringify(payload)}\n`);
const timer = setTimeout(() => {
  console.error(`MCP handshake timed out${stderr ? `: ${stderr.slice(-500)}` : ''}`);
  child.kill();
  process.exit(1);
}, 20000);

child.stderr.on('data', chunk => { stderr += chunk.toString(); });
child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim().startsWith('{')) continue;
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    if (message.id === 1 && message.result && !initialized) {
      initialized = true;
      send({ jsonrpc:'2.0', method:'notifications/initialized', params:{} });
      send({ jsonrpc:'2.0', id:2, method:'tools/list', params:{} });
    } else if (message.id === 2 && message.result && !listed) {
      listed = true;
      clearTimeout(timer);
      const tools = Array.isArray(message.result.tools) ? message.result.tools : [];
      console.log(JSON.stringify({ ok:true, server:message.result.serverInfo, tool_count:tools.length, tools:tools.map(tool => tool.name) }, null, 2));
      child.kill();
    } else if (message.error) {
      clearTimeout(timer);
      console.error(JSON.stringify(message.error));
      child.kill();
      process.exit(1);
    }
  }
});
child.on('error', error => {
  clearTimeout(timer);
  console.error(error.message);
  process.exit(1);
});
child.on('close', code => {
  if (!listed) {
    clearTimeout(timer);
    console.error(`MCP process closed before tools/list (code ${code})${stderr ? `: ${stderr.slice(-500)}` : ''}`);
    process.exit(1);
  }
});

send({
  jsonrpc:'2.0',
  id:1,
  method:'initialize',
  params:{ protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{ name:'decision-intelligence-workbench-check', version:'1.0.0' } }
});
