const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('whitespace details surface related players before the long proof ledger', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  assert.match(app,/function marketLandscapePreview/);
  const preview=app.indexOf("marketLandscapePreview(result,item,'whitespace')");
  const proof=app.indexOf('<section class="competition-evidence">',preview);
  assert.ok(preview>0);
  assert.ok(proof>preview);
});

test('current run includes niche listed and private specialists', () => {
  const result=JSON.parse(fs.readFileSync(path.join(__dirname,'..','runs','20260725042538-b1b56f','result.json'),'utf8'));
  const entities=result.market_landscape.entities;
  assert.ok(entities.some(entity=>entity.scale==='niche'&&entity.listing.status==='listed'));
  assert.ok(entities.some(entity=>entity.scale==='niche'&&entity.listing.status==='private'));
  assert.ok(entities.length>=18);
});
