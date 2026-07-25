const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('../lib/store.cjs');
const { buildSimulationRequest } = require('../lib/simulation.cjs');

const id = safeRunId(process.argv[2]);
const root = path.join(__dirname, '..', 'runs', id);
const request = readJson(path.join(root, 'request.json'));
const result = readJson(path.join(root, 'result.json'));
if (!request || !result) throw new Error(`completed run not found: ${id}`);
const payload = buildSimulationRequest(id, request, result);
writeJsonAtomic(path.join(root, 'simulation-request.json'), payload);
writeJsonAtomic(path.join(root, 'simulation-status.json'), { state: 'pending_codex', created_at: payload.created_at, updated_at: payload.created_at, message: 'Codexシミュレーションの実行待ちです。' });
fs.writeFileSync(path.join(root, 'EXECUTE_SIMULATION_WITH_CODEX.md'), `# Codexでシミュレーションを実行\n\n> ${payload.codex_prompt}\n`, 'utf8');
console.log(payload.codex_prompt);
