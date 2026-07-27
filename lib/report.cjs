function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

const labels = {
  executive:'エグゼクティブ結論', megatrends:'メガトレンド', knowledge_graph:'因果・ナレッジグラフ',
  whitespaces:'ホワイトスペース', market_landscape:'関連企業・サービス', profit_pools:'利益プール',
  investment_routes:'投資ルート', business_routes:'事業ルート', scenarios:'シナリオ', simulation_lab:'Simulation Lab',
  forecasts:'予測台帳', evidence:'証拠台帳', counterarguments:'反対仮説', methodology:'方法論', limitations:'限界・未確認事項',
  metadata:'レポート情報'
};

function humanize(key) {
  return labels[key] || String(key).replaceAll('_', ' ');
}

function renderPrimitive(value) {
  if (value === null || value === undefined || value === '') return '<span class="empty">未記載</span>';
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return `<a href="${esc(text)}">${esc(text)}</a>`;
  return esc(text);
}

function renderValue(value, depth = 0) {
  if (!value || typeof value !== 'object') return renderPrimitive(value);
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="empty">該当なし</span>';
    if (value.every(item => !item || typeof item !== 'object')) return `<ul>${value.map(item => `<li>${renderPrimitive(item)}</li>`).join('')}</ul>`;
    return `<div class="records">${value.map((item, index) => `<article class="record"><span class="record-no">${String(index + 1).padStart(2,'0')}</span>${renderValue(item, depth + 1)}</article>`).join('')}</div>`;
  }
  const entries = Object.entries(value).filter(([key]) => !['complete'].includes(key));
  return `<dl class="fields">${entries.map(([key, child]) => `<div class="field ${child && typeof child === 'object' ? 'nested' : ''}"><dt>${esc(humanize(key))}</dt><dd>${renderValue(child, depth + 1)}</dd></div>`).join('')}</dl>`;
}

function evidenceTable(items) {
  if (!Array.isArray(items) || !items.length) return '<p class="empty">証拠はありません。</p>';
  return `<div class="table-wrap"><table><thead><tr><th>ID / 種別</th><th>資料・発行元</th><th>支持する内容</th><th>限界</th></tr></thead><tbody>${items.map(item => `<tr><td><code>${esc(item.id)}</code><small>${esc(item.source_tier || '')} · ${esc(item.statement_type || '')}</small></td><td><strong>${esc(item.title || '')}</strong><small>${esc(item.publisher || '')}</small>${item.url ? `<a href="${esc(item.url)}">原典を開く</a>` : ''}</td><td>${renderValue(item.supports)}</td><td>${renderPrimitive(item.limitations)}</td></tr>`).join('')}</tbody></table></div>`;
}

function graph(result) {
  const nodes = result?.knowledge_graph?.nodes || [], edges = result?.knowledge_graph?.edges || [];
  if (!nodes.length) return '';
  const W=900,H=470,cx=450,cy=235,rx=325,ry=170;
  const pos=new Map(nodes.map((node,i)=>{const a=(i/nodes.length)*Math.PI*2-Math.PI/2;return[node.id,{x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry}]}));
  return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="因果・ナレッジグラフ"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto"><path d="M0 0L8 4L0 8z"/></marker></defs>${edges.map(edge=>{const a=pos.get(edge.source),b=pos.get(edge.target);return a&&b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${edge.polarity==='negative'?'negative':''}"/>`:''}).join('')}${nodes.map((node,i)=>{const p=pos.get(node.id);return `<g transform="translate(${p.x} ${p.y})"><circle r="23"/><text y="4">${i+1}</text><text class="node-label" y="42">${esc(node.label || node.id)}</text></g>`}).join('')}</svg>`;
}

function buildReportHtml(run, options = {}) {
  const result = run.result || {};
  const order=['executive','megatrends','knowledge_graph','whitespaces','market_landscape','profit_pools','investment_routes','business_routes','scenarios','simulation_lab','forecasts','counterarguments','methodology','evidence','limitations'];
  const sections=order.filter(key=>result[key] !== undefined).map((key,index)=>`<section id="s-${esc(key)}" class="report-section"><header><span>${String(index+1).padStart(2,'0')}</span><h2>${esc(labels[key] || humanize(key))}</h2></header>${key==='knowledge_graph'?graph(result):''}${key==='evidence'?evidenceTable(result[key]):renderValue(result[key])}</section>`).join('');
  const title=run.request?.query || result.metadata?.title || run.id;
  const generated=result.metadata?.generated_at || new Date().toISOString();
  const printScript=options.print ? '<script>addEventListener("load",()=>setTimeout(()=>print(),250));<\/script>' : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Opportunity Intelligence</title><style>
  :root{--ink:#17212b;--muted:#64707b;--line:#cfd6dc;--navy:#183f5a;--cyan:#2f8794;--paper:#f6f8f9;--risk:#a7473e}*{box-sizing:border-box}html{font-family:"Yu Gothic UI","Noto Sans JP",sans-serif;color:var(--ink);background:#dfe5e8}body{margin:0}.report{width:min(1120px,100%);margin:28px auto;background:white;box-shadow:0 18px 60px #263b4930}.cover{min-height:560px;padding:64px 72px;display:grid;grid-template-rows:auto 1fr auto;background:linear-gradient(135deg,#f7fafb 0 68%,#dcecef 68%)}.brand{font-size:12px;letter-spacing:.18em;color:var(--navy);font-weight:700}.cover h1{font-size:46px;line-height:1.18;max-width:820px;margin:auto 0 28px;letter-spacing:-.035em}.cover .thesis{max-width:760px;border-left:5px solid var(--cyan);padding:12px 0 12px 22px;font-size:20px;line-height:1.7}.meta{display:flex;gap:24px;font:12px ui-monospace,monospace;color:var(--muted)}.toc{padding:34px 72px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px}.toc a{color:var(--ink);font-size:13px;text-decoration:none;border-bottom:1px dotted var(--line);padding:7px 0}.report-section{padding:48px 72px;border-bottom:1px solid var(--line);break-before:page}.report-section>header{display:grid;grid-template-columns:44px 1fr;align-items:baseline;border-bottom:2px solid var(--navy);padding-bottom:11px;margin-bottom:26px}.report-section>header span{font:12px ui-monospace,monospace;color:var(--cyan)}h2{margin:0;font-size:26px}h3{font-size:16px}.fields{margin:0}.field{display:grid;grid-template-columns:minmax(150px,22%) 1fr;gap:18px;border-top:1px solid #e3e7ea;padding:10px 0}.field:first-child{border-top:0}.field.nested{display:block;padding:14px 0}.field.nested>dt{margin-bottom:10px;color:var(--navy);font-weight:750}.field dt{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.field dd{margin:0;line-height:1.65}.records{display:grid;gap:14px}.record{position:relative;border:1px solid var(--line);padding:18px 20px 18px 48px;break-inside:avoid;background:#fff}.record-no{position:absolute;left:15px;top:19px;font:11px ui-monospace,monospace;color:var(--cyan)}ul{margin:4px 0;padding-left:20px}li{margin:4px 0;line-height:1.55}a{color:#17667b;overflow-wrap:anywhere}.empty{color:var(--muted);font-style:italic}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid var(--line);padding:10px;vertical-align:top;text-align:left;line-height:1.55}th{background:#edf2f4;color:var(--navy)}td small,td a{display:block;margin-top:6px}code{font:10px ui-monospace,monospace}.graph{width:100%;height:auto;background:var(--paper);border:1px solid var(--line);margin-bottom:26px}.graph line{stroke:#5f7a8d;stroke-width:1.5;marker-end:url(#arrow)}.graph line.negative{stroke:var(--risk);stroke-dasharray:5 4}.graph circle{fill:white;stroke:var(--navy);stroke-width:2}.graph text{text-anchor:middle;font-size:10px}.graph .node-label{font-size:11px;font-weight:700}.footer{padding:20px 72px;color:var(--muted);font-size:10px}.print-action{position:fixed;right:18px;top:18px;border:0;background:var(--navy);color:white;padding:12px 16px;font-weight:700;cursor:pointer;box-shadow:0 8px 28px #263b4945}
  @media(max-width:720px){.report{margin:0}.cover,.report-section{padding:34px 22px}.cover h1{font-size:32px}.toc{padding:24px 22px;grid-template-columns:1fr}.field{display:block}.field dt{margin-bottom:6px}.print-action{position:static;margin:12px}.meta{display:block}.meta span{display:block;margin:5px 0}}
  @media print{@page{size:A4;margin:13mm}.report{width:auto;margin:0;box-shadow:none}.cover{min-height:245mm;padding:18mm;background:white}.toc{padding:8mm 0}.report-section{padding:8mm 0;border-bottom:0}.report-section:first-of-type{break-before:auto}.record{break-inside:avoid}.print-action{display:none}a{color:inherit;text-decoration:none}.graph{max-height:170mm}.footer{padding:8mm 0}body{background:white}}
  </style></head><body>${options.print?'<button class="print-action" onclick="print()">印刷 / PDFに保存</button>':''}<main class="report"><section class="cover"><div class="brand">OPPORTUNITY INTELLIGENCE / DECISION REPORT</div><div><h1>${esc(title)}</h1><p class="thesis">${esc(result.executive?.one_line || result.executive?.conclusion || '証拠・因果・シナリオ・行動を統合した意思決定レポート')}</p></div><div class="meta"><span>RUN ${esc(run.id)}</span><span>生成 ${esc(new Date(generated).toLocaleString('ja-JP'))}</span><span>${esc(run.request?.horizon || '')}</span></div></section><nav class="toc">${order.filter(key=>result[key]!==undefined).map((key,index)=>`<a href="#s-${esc(key)}">${String(index+1).padStart(2,'0')} ${esc(labels[key]||humanize(key))}</a>`).join('')}</nav>${sections}<footer class="footer">本レポートはOpportunity Intelligenceのrunから生成されました。事実・推論・仮定・合成シミュレーションの区分と各出典の限界を維持しています。</footer></main>${printScript}</body></html>`;
}

module.exports = { buildReportHtml };
