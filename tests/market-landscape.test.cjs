const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateResult } = require('../lib/validation.cjs');

function baseResult(entity) {
  return {
    schema_version:'1.0',
    metadata:{run_id:'market-test',title:'market test',generated_at:'2026-07-25'},
    executive:{one_line:'test',decision_spine:[]},
    megatrends:[{id:'m1'}],
    knowledge_graph:{nodes:[],edges:[]},
    whitespaces:[{id:'w1'}],
    market_landscape:{as_of:'2026-07-25',entities:[entity]},
    profit_pools:[],investment_routes:[],business_routes:[],scenarios:[],forecasts:[],
    evidence:[{id:'e1',title:'official',url:'https://example.com',source_tier:'primary',statement_type:'fact'}],
    counterarguments:[],methodology:[],limitations:[]
  };
}

test('listed market entities require ticker, exchange, links, and evidence', () => {
  const entity={id:'c1',name:'Company',entity_type:'company',listing:{status:'listed'},country:'JP',scale:'niche',role:'supplier',links:[{kind:'megatrend',id:'m1',relationship:'supplies'}],evidence_ids:['e1']};
  const errors=validateResult(baseResult(entity),'market-test');
  assert.ok(errors.some(error=>error.includes('requires ticker')));
  assert.ok(errors.some(error=>error.includes('requires exchange')));
  entity.listing.ticker='1234'; entity.listing.exchange='TSE Prime';
  assert.deepEqual(validateResult(baseResult(entity),'market-test'),[]);
});

test('market links must resolve to a real megatrend or whitespace', () => {
  const entity={id:'c1',name:'Company',entity_type:'company',listing:{status:'private'},country:'JP',scale:'niche',role:'supplier',links:[{kind:'whitespace',id:'missing',relationship:'supplies'}],evidence_ids:['e1']};
  assert.ok(validateResult(baseResult(entity),'market-test').some(error=>error.includes('unknown whitespace')));
});

test('UI renders a linked listed-company and service landscape', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  assert.match(app,/function marketLandscapePanel/);
  assert.match(app,/RELATED COMPANIES &amp; SERVICES/);
  assert.match(app,/LISTED PARENT/);
  assert.match(app,/投資妙味・割安性とは分けています/);
});

test('current run has verified listing fields for every listed market entity', () => {
  const result=JSON.parse(fs.readFileSync(path.join(__dirname,'..','runs','20260725042538-b1b56f','result.json'),'utf8'));
  const listed=result.market_landscape.entities.filter(entity=>['listed','listed_parent'].includes(entity.listing.status));
  assert.ok(listed.length>=10);
  for(const entity of listed){assert.ok(entity.listing.ticker,entity.name);assert.ok(entity.listing.exchange,entity.name);}
});
