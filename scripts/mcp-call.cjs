const fs = require('node:fs');
const { callMcpTool } = require('../lib/mcp-client.cjs');

const [serverId, toolName, rawArgs = '{}', argsPath] = process.argv.slice(2);
if (!serverId || !toolName) {
  console.error('Usage: node scripts/mcp-call.cjs <server-id> <tool-name> [args-json]');
  console.error('   or: node scripts/mcp-call.cjs <server-id> <tool-name> --args-file <json-path>');
  process.exit(2);
}

let args;
try { args = rawArgs === '--args-file' ? JSON.parse(fs.readFileSync(argsPath, 'utf8')) : JSON.parse(rawArgs); }
catch (error) { console.error(`Invalid args JSON: ${error.message}`); process.exit(2); }

callMcpTool(serverId, toolName, args)
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.stack || error.message); process.exit(1); });
