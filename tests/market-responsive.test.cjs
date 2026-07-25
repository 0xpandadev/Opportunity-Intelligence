const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('opportunity grid items can shrink inside mobile and tablet viewports', () => {
  const css=fs.readFileSync(path.join(__dirname,'..','public','styles.css'),'utf8');
  assert.match(css,/\.whitespace-layout\.evidence-first>\*\{min-width:0;max-width:100%\}/);
  assert.match(css,/@media\(max-width:1220px\)\{\.trend-visual-grid,\.whitespace-layout\.evidence-first,\.profit-board\{grid-template-columns:1fr\}/);
});
