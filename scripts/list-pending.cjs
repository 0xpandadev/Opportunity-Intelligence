const fs = require('node:fs');
const path = require('node:path');
const { readJson } = require('../lib/store.cjs');
const root = path.join(__dirname, '..', 'runs');
const pending = fs.readdirSync(root, { withFileTypes:true }).filter(item => item.isDirectory()).map(item => {
  const status = readJson(path.join(root, item.name, 'status.json'), {});
  const request = readJson(path.join(root, item.name, 'request.json'), {});
  return { id:item.name, state:status.state, query:request.query, created_at:request.created_at };
}).filter(item => item.state === 'pending_codex');
console.log(JSON.stringify({ pending }, null, 2));
