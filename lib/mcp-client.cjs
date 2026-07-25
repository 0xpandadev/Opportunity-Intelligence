const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(__dirname, '..', 'config', 'mcp-servers.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function getServer(id) {
  const server = readManifest().servers.find(item => item.id === id);
  if (!server) throw new Error(`Unknown MCP server: ${id}`);
  if (!['verified', 'installed_pending_verification'].includes(server.state)) throw new Error(`MCP server is not runnable: ${id} (${server.state})`);
  return server;
}

function startServer(server) {
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(server.command);
  return spawn(server.command, server.args || [], {
    cwd: server.cwd,
    env: { ...process.env, ...(server.env || {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell
  });
}

async function transact(serverId, operation) {
  const server = getServer(serverId);
  if (server.transport === 'streamable-http') return transactRemote(serverId, server, operation);
  const child = startServer(server);
  let buffer = '';
  let stderr = '';
  let initialized = false;
  let finished = false;
  const timeoutMs = Number(server.timeout_ms) || 30000;

  return new Promise((resolve, reject) => {
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error); else resolve({ server_id:serverId, server_name:server.name, fetched_at:new Date().toISOString(), ...result });
    };
    const send = message => child.stdin.write(`${JSON.stringify(message)}\n`);
    const timer = setTimeout(() => finish(new Error(`MCP ${serverId} timed out${stderr ? `: ${stderr.slice(-400)}` : ''}`)), timeoutMs);
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', finish);
    child.on('close', code => { if (!finished) finish(new Error(`MCP ${serverId} closed before response (code ${code})${stderr ? `: ${stderr.slice(-400)}` : ''}`)); });
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
          send({ jsonrpc:'2.0', id:2, method:operation.method, params:operation.params || {} });
        } else if (message.id === 2) {
          if (message.error) finish(new Error(message.error.message || JSON.stringify(message.error)));
          else if (message.result?.isError) {
            const detail = (message.result.content || []).map(item => item.text).filter(Boolean).join(' ') || 'MCP tool returned isError';
            finish(new Error(detail));
          } else finish(null, { result:message.result, stderr:stderr.trim() || undefined });
        }
      }
    });
    send({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{ name:'decision-intelligence-workbench', version:'1.0.0' } } });
  });
}

function decodeMcpResponse(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const data = trimmed.split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(Boolean)
    .pop();
  return data ? JSON.parse(data) : null;
}

async function remotePost(server, message, sessionId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(server.timeout_ms) || 30000);
  try {
    const headers = { 'content-type':'application/json', accept:'application/json, text/event-stream' };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const response = await fetch(server.url, { method:'POST', headers, body:JSON.stringify(message), signal:controller.signal });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0, 500)}`);
    return { message:decodeMcpResponse(raw), sessionId:response.headers.get('mcp-session-id') || sessionId };
  } finally { clearTimeout(timeout); }
}

async function transactRemote(serverId, server, operation) {
  const init = await remotePost(server, { jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{ name:'decision-intelligence-workbench', version:'1.0.0' } } });
  if (init.message?.error) throw new Error(init.message.error.message || JSON.stringify(init.message.error));
  await remotePost(server, { jsonrpc:'2.0', method:'notifications/initialized', params:{} }, init.sessionId);
  const response = await remotePost(server, { jsonrpc:'2.0', id:2, method:operation.method, params:operation.params || {} }, init.sessionId);
  if (response.message?.error) throw new Error(response.message.error.message || JSON.stringify(response.message.error));
  if (response.message?.result?.isError) {
    const detail = (response.message.result.content || []).map(item => item.text).filter(Boolean).join(' ') || 'MCP tool returned isError';
    throw new Error(detail);
  }
  return { server_id:serverId, server_name:server.name, fetched_at:new Date().toISOString(), result:response.message?.result };
}

function listMcpTools(serverId) {
  return transact(serverId, { method:'tools/list', params:{} });
}

function callMcpTool(serverId, toolName, args = {}) {
  return transact(serverId, { method:'tools/call', params:{ name:toolName, arguments:args } });
}

function routeMcpServers(query, options = {}) {
  const manifest = readManifest();
  const text = `${query || ''} ${(options.regions || []).join(' ')} ${(options.domains || []).join(' ')}`.toLowerCase();
  return manifest.servers.map(server => {
    let score = 0;
    const matches = [];
    for (const keyword of server.keywords || []) {
      if (text.includes(String(keyword).toLowerCase())) { score += 4; matches.push(keyword); }
    }
    for (const domain of server.domains || []) {
      if (text.includes(String(domain).toLowerCase())) { score += 2; matches.push(domain); }
    }
    for (const region of server.regions || []) {
      if (text.includes(String(region).toLowerCase())) { score += 2; matches.push(region); }
    }
    const usable = server.state === 'verified';
    if (matches.length && usable) score += 1;
    return { id:server.id, name:server.name, state:server.state, usable, score, matches:[...new Set(matches)], domains:server.domains, tool_count:server.tool_count };
  }).filter(item => item.matches.length && item.usable).sort((a,b) => b.score-a.score).slice(0, Number(options.limit) || 6);
}

module.exports = { readManifest, getServer, listMcpTools, callMcpTool, routeMcpServers };
