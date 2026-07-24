const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
const {compileRequest}=require('../lib/compiler.cjs'); const {validateResult}=require('../lib/validation.cjs'); const {writeJsonAtomic,readJson,safeRunId}=require('../lib/store.cjs');
const catalog=require('../config/catalog.json');

test('compiler infers region, sector, and decision type',()=>{
  const request=compileRequest({query:'欧州の農業テック関連株を2030年まで分析して'},catalog);
  assert.ok(request.regions.includes('europe')); assert.ok(request.sectors.includes('agriculture')); assert.ok(request.sectors.includes('technology')); assert.ok(request.decision_types.includes('investment')); assert.equal(request.evidence_policy.primary_sources_first,true);
});

test('result validator accepts minimal traceable result',()=>{
  const result={schema_version:'1.0',metadata:{run_id:'run-1',title:'x',generated_at:new Date().toISOString()},executive:{one_line:'x',decision_spine:[]},megatrends:[],knowledge_graph:{nodes:[],edges:[]},whitespaces:[],profit_pools:[],investment_routes:[],business_routes:[],scenarios:[],forecasts:[],evidence:[],counterarguments:[],methodology:[],limitations:[]};
  assert.deepEqual(validateResult(result,'run-1'),[]);
});

test('result validator rejects dangling evidence references',()=>{
  const result={schema_version:'1.0',metadata:{run_id:'r',title:'x',generated_at:'x'},executive:{one_line:'x',decision_spine:[{evidence_ids:['missing']}]},megatrends:[],knowledge_graph:{nodes:[],edges:[]},whitespaces:[],profit_pools:[],investment_routes:[],business_routes:[],scenarios:[],forecasts:[],evidence:[],counterarguments:[],methodology:[],limitations:[]};
  assert.ok(validateResult(result,'r').includes('unknown evidence reference: missing'));
});

test('atomic JSON store round trips within a validated temp target',t=>{
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'diw-store-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'x.json'); writeJsonAtomic(file,{ok:true}); assert.deepEqual(readJson(file),{ok:true}); assert.equal(safeRunId('20260725-abc'),'20260725-abc'); assert.throws(()=>safeRunId('../bad'));
});
