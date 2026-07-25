const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSimulationRequest, validateSimulation } = require('../lib/simulation.cjs');

function validSimulation(runId='run-1') {
  return {
    schema_version:'1.0', run_id:runId, classification:'synthetic', engine:'codex_mirofish_method', generated_at:new Date().toISOString(),
    environment:{summary:'world'},
    agents:Array.from({length:4},(_,index)=>({id:`a${index+1}`,name:`Agent ${index+1}`,objective:'test',decision_rules:['wait'],evidence_ids:['e1']})),
    rounds:2,
    round_log:[1,2].map(round=>({round,focus:'test',evidence_ids:['e1']})),
    interactions:[], emergent_events:[], interventions:[], outcomes:[], falsifiers:[],
    report:{executive_summary:'test',robust_actions:[],contingent_actions:[],avoid:[]}, limitations:[]
  };
}

test('simulation request is an internal Codex handoff with bounded configuration', () => {
  const request=buildSimulationRequest('run-1',{query:'test market',regions:['Japan'],sectors:['data center']},{evidence:[],scenarios:[],knowledge_graph:{nodes:[],edges:[]}}, {agent_count:999,rounds:1});
  assert.equal(request.engine,'codex_mirofish_method');
  assert.equal(request.configuration.agent_count,24);
  assert.equal(request.configuration.rounds,3);
  assert.match(request.codex_prompt,/run-opportunity-simulation/);
  assert.equal(request.classification,'synthetic_scenario_request');
});

test('simulation validation preserves evidence boundary', () => {
  const simulation=validSimulation();
  assert.deepEqual(validateSimulation(simulation,'run-1',new Set(['e1'])),[]);
  simulation.agents[0].evidence_ids=['invented'];
  assert.ok(validateSimulation(simulation,'run-1',new Set(['e1'])).includes('unknown evidence reference: invented'));
});

test('Simulation Lab UI uses internal Codex execution instead of seed download as primary action', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  assert.match(source,/OPPORTUNITY INTELLIGENCE \/ SIMULATION LAB/);
  assert.match(source,/simulation\/request/);
  assert.match(source,/Codexシミュレーション依頼を作成/);
  assert.doesNotMatch(source,/id="mirofish-export"/);
  assert.doesNotMatch(source,/id="mirofish-download"/);
});
