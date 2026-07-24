const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('../lib/store.cjs');
const { validateResult } = require('../lib/validation.cjs');
const id = safeRunId(process.argv[2]);
const sourceArg = process.argv[3];
if (!sourceArg) throw new Error('Usage: node scripts/complete-run.cjs <run-id> <result-json-file>');
const source = path.resolve(sourceArg); const result = JSON.parse(fs.readFileSync(source, 'utf8'));
const errors = validateResult(result, id); if (errors.length) { console.error(JSON.stringify({ valid:false, errors }, null, 2)); process.exit(1); }
const dir = path.join(__dirname, '..', 'runs', id); const previous = readJson(path.join(dir, 'status.json'), {});
writeJsonAtomic(path.join(dir, 'result.json'), result);
writeJsonAtomic(path.join(dir, 'status.json'), { state:'complete', created_at:previous.created_at, updated_at:new Date().toISOString(), message:'Codexで調査し、スキーマ検証した結果です。' });
console.log(JSON.stringify({ valid:true, completed:id, result:path.join(dir, 'result.json') }, null, 2));
