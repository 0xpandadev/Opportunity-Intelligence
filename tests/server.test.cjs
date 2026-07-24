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
});
