const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const os=require('node:os'); const path=require('node:path'); const net=require('node:net'); const {spawn}=require('node:child_process');

function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function waitFor(url){for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('server did not start');}

test('server persists a request and accepts a validated result',{timeout:15000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'diw-server-')); const port=await freePort();
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,DIW_PORT:String(port),DIW_RUNS_DIR:dir},stdio:'ignore'});
  t.after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});}); await waitFor(`http://127.0.0.1:${port}/api/health`);
  let response=await fetch(`http://127.0.0.1:${port}/api/requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'世界の材料市場のホワイトスペースを分析する'})});
  assert.equal(response.status,201); const run=await response.json(); assert.equal(run.status.state,'pending_codex'); assert.ok(fs.existsSync(path.join(dir,run.id,'request.json')));
  const result={schema_version:'1.0',metadata:{run_id:run.id,title:'test',generated_at:new Date().toISOString()},executive:{one_line:'test',decision_spine:[]},megatrends:[],knowledge_graph:{nodes:[],edges:[]},whitespaces:[],profit_pools:[],investment_routes:[],business_routes:[],scenarios:[],forecasts:[],evidence:[],counterarguments:[],methodology:[],limitations:[]};
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}/result`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)}); assert.equal(response.status,200); const completed=await response.json(); assert.equal(completed.status.state,'complete');
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}/mirofish/export`,{method:'POST'}); assert.equal(response.status,200); const exported=await response.json(); assert.equal(exported.classification,'synthetic_scenario_input'); assert.ok(exported.download_url);
  response=await fetch(`http://127.0.0.1:${port}${exported.download_url}`); assert.equal(response.status,200); const seed=await response.json(); assert.equal(seed.run_id,run.id); assert.equal(seed.classification,'synthetic_scenario_input');
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}/simulation/request`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agent_count:4,rounds:3})});
  assert.equal(response.status,201); const requested=await response.json(); assert.equal(requested.simulation.status.state,'pending_codex'); assert.equal(requested.simulation.request.configuration.agent_count,4);
  const agents=Array.from({length:4},(_,index)=>({id:`a${index+1}`,name:`Agent ${index+1}`,objective:'test objective',decision_rules:['preserve option value'],evidence_ids:[]}));
  const simulation={schema_version:'1.0',run_id:run.id,classification:'synthetic',engine:'codex_mirofish_method',generated_at:new Date().toISOString(),environment:{summary:'test world'},agents,rounds:3,round_log:[1,2,3].map(round=>({round,focus:'test',summary:'test',actions:[],state_changes:[],minority_views:[],evidence_ids:[]})),interactions:[],emergent_events:[],interventions:[],outcomes:[],falsifiers:[],report:{executive_summary:'test',robust_actions:[],contingent_actions:[],avoid:[]},limitations:[]};
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}/simulation/result`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(simulation)}); assert.equal(response.status,200); const simulated=await response.json(); assert.equal(simulated.simulation.status.state,'complete'); assert.equal(simulated.result.simulation_lab.status,'complete');
});

test('server moves a deleted run to recoverable trash',{timeout:15000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'diw-delete-')); const port=await freePort();
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,DIW_PORT:String(port),DIW_RUNS_DIR:dir},stdio:'ignore'});
  t.after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});}); await waitFor(`http://127.0.0.1:${port}/api/health`);
  let response=await fetch(`http://127.0.0.1:${port}/api/requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'削除動作を検証する分析run'})});
  const run=await response.json(); assert.equal(response.status,201);
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}`,{method:'DELETE'}); const deleted=await response.json();
  assert.equal(response.status,200); assert.equal(deleted.deleted,true); assert.equal(deleted.recoverable,true);
  assert.equal(fs.existsSync(path.join(dir,run.id)),false);
  const trashed=fs.readdirSync(path.join(dir,'.trash')); assert.ok(trashed.some(name=>name.startsWith(`${run.id}-`)));
  response=await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}`); assert.equal(response.status,404);
});
