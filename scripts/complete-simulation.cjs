const path = require('node:path');
const { readJson, safeRunId } = require('../lib/store.cjs');
const { completeSimulation } = require('../lib/simulation.cjs');

const id = safeRunId(process.argv[2]);
const input = process.argv[3];
if (!input) throw new Error('usage: node scripts/complete-simulation.cjs <run-id> <simulation-result.json>');
const simulation = readJson(path.resolve(input));
const completed = completeSimulation(path.join(__dirname, '..', 'runs'), id, simulation);
if (!completed.valid) {
  console.error(JSON.stringify({ valid: false, errors: completed.errors }, null, 2));
  process.exitCode = 1;
} else console.log(JSON.stringify({ valid: true, run_id: id, status: 'complete' }, null, 2));
