const path = require('node:path');
const { readJson, safeRunId } = require('../lib/store.cjs');
const { validateResult } = require('../lib/validation.cjs');
const id = safeRunId(process.argv[2]);
const result = readJson(path.join(__dirname, '..', 'runs', id, process.argv[3] || 'result.json'));
const errors = validateResult(result, id);
if (errors.length) { console.error(JSON.stringify({ valid:false, errors }, null, 2)); process.exitCode = 1; }
else console.log(JSON.stringify({ valid:true, run_id:id }, null, 2));
