const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('../lib/store.cjs');
const id=safeRunId(process.argv[2]); const root=path.join(__dirname,'..','runs',id); const request=readJson(path.join(root,'request.json')); const draft=readJson(path.join(root,'result.draft.json'),{});
if(!request) throw new Error(`run not found: ${id}`);
const payload={schema_version:'1.0',run_id:id,classification:'synthetic_scenario_input',question:request.query,horizon:request.horizon,regions:request.regions,sectors:request.sectors,scenario_seeds:draft.scenarios||[],knowledge_graph:draft.knowledge_graph||{nodes:[],edges:[]},rules:['Do not treat simulated statements as facts','Return provenance for every imported synthetic output']};
const target=path.join(root,'mirofish-input.json');writeJsonAtomic(target,payload);console.log(target);
