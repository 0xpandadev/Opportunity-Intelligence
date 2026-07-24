const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('../lib/store.cjs');
const id=safeRunId(process.argv[2]); const state=String(process.argv[3]||'researching');
if (!['pending_codex','researching','complete','failed'].includes(state)) throw new Error('invalid state');
const file=path.join(__dirname,'..','runs',id,'status.json'); const previous=readJson(file);
if (!previous) throw new Error(`run not found: ${id}`);
writeJsonAtomic(file,{...previous,state,updated_at:new Date().toISOString(),message:process.argv.slice(4).join(' ')||({researching:'Codexが一次情報と反証を調査しています。',failed:'分析に失敗しました。'}[state]||previous.message)});
console.log(JSON.stringify(readJson(file),null,2));
