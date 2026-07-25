const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateResult } = require('../lib/validation.cjs');
const catalog = require('../config/catalog.json');

function resultWithWhitespace(whitespace) {
  return {
    schema_version:'1.0',
    metadata:{run_id:'white-test',title:'test',generated_at:new Date().toISOString()},
    executive:{one_line:'test',decision_spine:[]},
    megatrends:[],
    knowledge_graph:{nodes:[],edges:[]},
    whitespaces:[whitespace],
    profit_pools:[],investment_routes:[],business_routes:[],scenarios:[],forecasts:[],
    evidence:[{id:'e1',title:'customer evidence',url:'https://example.com/e1',source_tier:'primary',statement_type:'fact'}],
    counterarguments:[],methodology:[],limitations:[]
  };
}

test('white classification is rejected until willingness to pay is explicitly verified', () => {
  const whitespace = {
    classification:'white',
    competition:{
      current_alternatives:['manual workflow'],density:'low',saturation_score:.25,unmet_need_score:.8,
      gap:'buyers cannot complete the job',willingness_to_pay:'high possibility',evidence_ids:['e1']
    }
  };
  const errors = validateResult(resultWithWhitespace(whitespace),'white-test');
  assert.ok(errors.includes('whitespaces[0] classified white requires wtp_verified=true'));
  whitespace.competition.wtp_verified = true;
  assert.equal(validateResult(resultWithWhitespace(whitespace),'white-test').some(error=>error.includes('wtp_verified')),false);
});

test('MiroFish is registered as a synthetic multi-agent simulation method', () => {
  const method = catalog.methods.find(item=>item.id==='mirofish_simulation');
  assert.equal(method.name,'MiroFish / Multi-Agent World Simulation');
  assert.ok(method.procedure.length>=5);
  assert.ok(method.references.some(reference=>reference.url==='https://github.com/666ghj/MiroFish'));
  assert.match(method.limits,/一次証拠もない/);
});

test('white-space UI exposes market crowding, alternatives, and WTP proof', () => {
  const source = fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  assert.match(source,/MARKET CROWDING MAP/);
  assert.match(source,/market-alternative-point/);
  assert.match(source,/WHITE \/ VERIFIED/);
  assert.match(source,/wtp_verified/);
});
