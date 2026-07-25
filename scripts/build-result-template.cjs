const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('../lib/store.cjs');
const id = safeRunId(process.argv[2]);
const dir = path.join(__dirname, '..', 'runs', id);
const request = readJson(path.join(dir, 'request.json'));
if (!request) throw new Error(`run not found: ${id}`);
const template = {
  schema_version:'1.0', metadata:{ run_id:id, title:request.query, generated_at:new Date().toISOString(), as_of:new Date().toISOString().slice(0,10), coverage:{ regions:request.regions, sectors:request.sectors, horizon:request.horizon }, decision:request.decision_types },
  executive:{ one_line:'', decision:'', confidence:0, why_now:[], watchouts:[], decision_spine:[] },
  megatrends:[], knowledge_graph:{ nodes:[], edges:[] }, whitespaces:[], profit_pools:[], investment_routes:[], business_routes:[], scenarios:[], simulation_lab:{ status:'not_run', source_classification:'synthetic' }, forecasts:[], evidence:[], counterarguments:[], methodology:[], limitations:[]
};
const target = path.join(dir, 'result.template.json'); writeJsonAtomic(target, template); console.log(target);
