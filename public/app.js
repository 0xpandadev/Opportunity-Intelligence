const state = { catalog:null, connectors:null, runs:[], current:null, tab:'executive', connectorFilter:'all', polling:null };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const tabs = [
  ['executive','結論'],['transformation','変革マップ'],['megatrends','メガトレンド'],['whitespace','ホワイトスペース'],
  ['profit','利益プール'],['investment','投資ルート'],['business','事業ルート'],['scenarios','シナリオ'],
  ['evidence','証拠台帳'],['forecasts','予測台帳'],['connectors','データ接続'],['methods','方法論']
];

function esc(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeUrl(value='') { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } }
function arr(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function textList(value) { return arr(value).map(esc).join(' / ') || '—'; }
function pct(value) { const n = Number(value); if (!Number.isFinite(n)) return 0; return n <= 1 ? Math.round(n*100) : Math.round(n); }
function score(value) { const n = Number(value); if (!Number.isFinite(n)) return 50; return n <= 1 ? Math.round(n*100) : Math.min(100,Math.round(n)); }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); }
function formatDate(value) { if (!value) return '—'; try { return new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium'}).format(new Date(value)); } catch { return value; } }
function tags(values, className='') { return arr(values).map(value=>`<span class="tag ${className}">${esc(value)}</span>`).join(''); }
function evidenceTags(ids) { return arr(ids).length ? `<div class="tag-list">${arr(ids).map(id=>`<span class="tag">↗ ${esc(id)}</span>`).join('')}</div>` : ''; }

async function api(path, options={}) {
  const response = await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.details?.join(' / ') || data.message || data.error || `HTTP ${response.status}`);
  return data;
}

async function init() {
  try {
    const [health,catalog,connectors,runs] = await Promise.all([api('/api/health'),api('/api/catalog'),api('/api/connectors'),api('/api/runs')]);
    state.catalog=catalog; state.connectors=connectors; state.runs=runs.runs;
    $('#health-dot').classList.add('online'); $('#health-text').textContent=`稼働中 · ${health.version}`;
    renderRuns(); bind();
    const requested = new URLSearchParams(location.search).get('run');
    if (requested || state.runs[0]) await openRun(requested || state.runs[0].id); else showComposer();
  } catch(error) {
    $('#health-text').textContent='サーバー未接続';
    $('#composer').innerHTML=`<div class="composer-intro"><span class="section-index">CONNECTION ERROR</span><h2>ローカルサーバーに接続できません</h2><p>${esc(error.message)}</p><p><code>START.cmd</code> を実行し、この画面を再読み込みしてください。</p></div>`;
  }
}

function bind() {
  $('#request-form').addEventListener('submit',submitRequest);
  $('#new-analysis').addEventListener('click',showComposer);
  $$('.quiet-button').forEach(button=>button.addEventListener('click',()=>showGlobal(button.dataset.tab)));
  $('#view-tabs').addEventListener('click',event=>{ const button=event.target.closest('[data-tab]'); if(button){state.tab=button.dataset.tab;renderTabs();renderView();} });
  $('#global-content').addEventListener('click',event=>{ const button=event.target.closest('[data-filter]'); if(button){state.connectorFilter=button.dataset.filter;renderGlobalContent('connectors');} });
  $('#run-status').addEventListener('click',async event=>{
    const copy=event.target.closest('[data-copy]'); if(copy){ await navigator.clipboard.writeText(copy.dataset.copy); toast('Codex用の依頼文をコピーしました'); }
    const refresh=event.target.closest('[data-refresh]'); if(refresh&&state.current) await openRun(state.current.id,true);
  });
}

function renderRuns() {
  $('#run-list').innerHTML=state.runs.length ? state.runs.map(run=>`<button class="run-button ${state.current?.id===run.id?'active':''}" data-run="${esc(run.id)}"><strong>${esc(run.title)}</strong><span><i>${esc(run.status?.state||'unknown')}</i><time>${formatDate(run.created_at)}</time></span></button>`).join('') : '<div class="run-button">まだ分析はありません</div>';
  $$('#run-list [data-run]').forEach(button=>button.addEventListener('click',()=>openRun(button.dataset.run)));
}

function showComposer() {
  clearInterval(state.polling); state.current=null; renderRuns();
  $('#composer').classList.remove('hidden'); $('#run-shell').classList.add('hidden'); $('#global-content').classList.add('hidden');
  $('#page-title').textContent='意思決定のための未来分析'; history.replaceState(null,'',location.pathname); $('#query')?.focus();
}

async function submitRequest(event) {
  event.preventDefault(); const submit=event.currentTarget.querySelector('button[type=submit]'); submit.disabled=true;
  try {
    const selected = [...$('#decision-types').selectedOptions].map(option=>option.value);
    const run = await api('/api/requests',{method:'POST',body:JSON.stringify({query:$('#query').value,decision_types:selected,horizon:$('#horizon').value,constraints:$('#constraints').value})});
    state.runs.unshift({id:run.id,title:run.request.query,created_at:run.request.created_at,status:run.status}); toast('分析runを作成しました'); await openRun(run.id);
  } catch(error) { toast(`作成できません: ${error.message}`); }
  finally { submit.disabled=false; }
}

async function openRun(id, quiet=false) {
  try {
    state.current=await api(`/api/runs/${encodeURIComponent(id)}`); state.tab='executive';
    $('#composer').classList.add('hidden'); $('#global-content').classList.add('hidden'); $('#run-shell').classList.remove('hidden');
    $('#page-title').textContent=state.current.request.query; history.replaceState(null,'',`?run=${encodeURIComponent(id)}`);
    const listed=state.runs.find(run=>run.id===id); if(listed) listed.status=state.current.status; else state.runs.unshift({id,title:state.current.request.query,created_at:state.current.request.created_at,status:state.current.status});
    renderRuns(); renderStatus(); renderTabs(); renderView();
    clearInterval(state.polling); if(state.current.status?.state==='pending_codex') state.polling=setInterval(()=>openRun(id,true),5000);
    if(!quiet) window.scrollTo({top:0,behavior:'smooth'});
  } catch(error) { toast(`分析を開けません: ${error.message}`); }
}

function renderStatus() {
  const run=state.current, status=run.status?.state||'unknown', complete=status==='complete';
  const prompt=`Decision Intelligence Workbench の保留中run ${run.id} を、run-decision-intelligenceスキルで実行して。`;
  $('#run-status').innerHTML=`<div class="run-status-card"><div><span class="kicker">RUN ${esc(run.id)}</span><h2>${esc(run.request.query)}</h2><p>${textList(run.request.regions)} · ${textList(run.request.sectors)} · ${esc(run.request.horizon)}</p>${!complete?`<div class="handoff"><strong>次の工程：Codexで実データ分析</strong><p>依頼は保存済みです。追加AI APIキーは不要ですが、Codexデスクトップで下の依頼を実行してください。ブラウザだけでAI処理済みとは表示しません。</p><code>${esc(prompt)}</code><div class="handoff-actions"><button class="small-button primary" data-copy="${esc(prompt)}">依頼文をコピー</button><button class="small-button" data-refresh>結果を確認</button></div></div>`:''}</div><span class="status-badge ${esc(status)}">${esc(status)}</span></div>`;
}

function renderTabs() {
  $('#view-tabs').innerHTML=tabs.map(([id,label])=>`<button class="tab-button ${state.tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('');
}

function renderView() {
  const root=$('#view-content'), result=state.current?.result;
  if(['connectors','methods'].includes(state.tab)){ root.innerHTML=state.tab==='connectors'?connectorsView():methodsView(); bindDynamic(); return; }
  if(!result){ root.innerHTML=`<div class="empty-state"><span class="section-index">ANALYSIS PENDING</span><h2>結果はまだ生成されていません</h2><p>依頼は失われていません。上のCodex用依頼を実行すると、検証済みJSONを読み込んで全ビューが有効になります。</p></div>`; return; }
  const renderers={executive:executiveView,transformation:transformationView,megatrends:megatrendsView,whitespace:whitespaceView,profit:profitView,investment:investmentView,business:businessView,scenarios:scenariosView,evidence:evidenceView,forecasts:forecastsView};
  root.innerHTML=(renderers[state.tab]||executiveView)(result); bindDynamic();
}

function showGlobal(tab) {
  clearInterval(state.polling); $('#composer').classList.add('hidden'); $('#run-shell').classList.add('hidden'); $('#global-content').classList.remove('hidden');
  $('#page-title').textContent=tab==='connectors'?'データ接続状況':'分析方法論'; renderGlobalContent(tab);
}
function renderGlobalContent(tab){ $('#global-content').innerHTML=tab==='connectors'?connectorsView():methodsView(); bindDynamic(); }
function bindDynamic(){
  $$('#global-content [data-filter],#view-content [data-filter]').forEach(button=>button.addEventListener('click',()=>{state.connectorFilter=button.dataset.filter; const html=connectorsView(); if(!$('#global-content').classList.contains('hidden')) $('#global-content').innerHTML=html; else $('#view-content').innerHTML=html; bindDynamic();}));
  $$('#view-content [data-forecast-update]').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.forecastUpdate, input=$(`#forecast-${CSS.escape(id)}`), probability=Number(input.value)/100;
    try{state.current=await api(`/api/runs/${state.current.id}/forecasts/${encodeURIComponent(id)}/updates`,{method:'POST',body:JSON.stringify({probability,note:'GUI probability update'})});renderView();toast('予測確率を更新しました');}catch(error){toast(error.message);}
  }));
  $$('#view-content [data-forecast-resolve]').forEach(button=>button.addEventListener('click',async()=>{
    const [id,outcome]=button.dataset.forecastResolve.split('|');
    try{state.current=await api(`/api/runs/${state.current.id}/forecasts/${encodeURIComponent(id)}/resolve`,{method:'POST',body:JSON.stringify({outcome:Number(outcome),note:'GUI resolution'})});renderView();toast('予測を解像しBrier scoreを記録しました');}catch(error){toast(error.message);}
  }));
}

function metricStrip(result){return `<div class="metric-strip"><div class="metric"><b>${arr(result.megatrends).length}</b><span>MEGATRENDS</span></div><div class="metric"><b>${arr(result.whitespaces).length}</b><span>WHITESPACES</span></div><div class="metric"><b>${arr(result.evidence).length}</b><span>EVIDENCE ITEMS</span></div><div class="metric"><b>${arr(result.forecasts).length}</b><span>SCORED FORECASTS</span></div></div>`;}

function executiveView(result) {
  const ex=result.executive||{};
  return `${metricStrip(result)}<div class="grid two"><article class="card dark"><span class="kicker">EXECUTIVE CONCLUSION</span><div class="decision-line">${esc(ex.one_line)}</div><p>${esc(ex.decision)}</p><div class="confidence"><span>CONFIDENCE ${pct(ex.confidence)}%</span><div class="confidence-track"><span style="width:${pct(ex.confidence)}%"></span></div></div></article><article class="card"><span class="kicker">DECISION SPINE</span><div class="spine">${arr(ex.decision_spine).map(item=>`<div class="spine-item"><div><strong>${esc(item.step||item.claim)}</strong><small>${esc(item.claim||'')}</small>${evidenceTags(item.evidence_ids)}</div></div>`).join('')||'<p>Decision Spineはありません。</p>'}</div></article></div><div class="grid two" style="margin-top:18px"><article class="card"><span class="kicker">WHY NOW</span><h3>いま動く根拠</h3>${arr(ex.why_now).map(item=>`<p>→ ${esc(item)}</p>`).join('')||'<p>—</p>'}</article><article class="card"><span class="kicker">WATCHOUTS</span><h3>反証・注意点</h3>${arr(ex.watchouts).map(item=>`<p>× ${esc(item)}</p>`).join('')}${arr(result.counterarguments).slice(0,4).map(item=>`<p>× ${esc(item.claim||item)}</p>`).join('')}</article></div>`;
}

function transformationView(result) {
  const graph=result.knowledge_graph||{nodes:[],edges:[]}, nodes=arr(graph.nodes).slice(0,36), edges=arr(graph.edges).filter(edge=>nodes.some(n=>n.id===edge.source)&&nodes.some(n=>n.id===edge.target));
  const W=1000,H=540,cx=W/2,cy=H/2; const colors={trend:'#d7e54a',driver:'#29a3a9',risk:'#c83b2d',sector:'#d89226',company:'#b9a7e8',policy:'#67a66e',technology:'#6fa3d9',evidence:'#9aa098'};
  const positions=new Map(nodes.map((node,i)=>{const ring=i%3,angle=(i/nodes.length)*Math.PI*2+(ring*.4),radius=105+ring*95;return[node.id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius}]}));
  const edgeSvg=edges.map(edge=>{const a=positions.get(edge.source),b=positions.get(edge.target);return `<line class="graph-edge ${edge.polarity==='negative'?'negative':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${Math.max(1,Number(edge.weight||.5)*4)}"><title>${esc(edge.type)}</title></line>`}).join('');
  const nodeSvg=nodes.map(node=>{const p=positions.get(node.id),r=7+score(node.confidence)/18;return `<g class="graph-node"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${colors[node.type]||'#e7e5dc'}"><title>${esc(node.label)} / ${esc(node.type)}</title></circle><text x="${p.x+r+5}" y="${p.y+4}">${esc(node.label)}</text></g>`}).join('');
  return `<div class="graph-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Transformation and knowledge graph">${edgeSvg}${nodeSvg}</svg><div class="graph-legend">NODE = trend / driver / risk / sector / company / policy / technology · RED EDGE = negative</div></div><div class="grid two" style="margin-top:18px"><div class="card"><span class="kicker">SYSTEM LOGIC</span><h3>因果関係</h3>${edges.slice(0,10).map(edge=>`<p><b>${esc(nodes.find(n=>n.id===edge.source)?.label||edge.source)}</b> → ${esc(edge.type)} → <b>${esc(nodes.find(n=>n.id===edge.target)?.label||edge.target)}</b></p>`).join('')||'<p>グラフの関係はありません。</p>'}</div><div class="card"><span class="kicker">GRAPH QUALITY</span><h3>証拠との接続</h3><p>${nodes.filter(n=>arr(n.evidence_ids).length).length} / ${nodes.length} ノードに証拠参照があります。</p><p>合成シナリオは <span class="tag synthetic">synthetic</span> として一次事実から分離します。</p></div></div>`;
}

function megatrendsView(result) {
  const trends=arr(result.megatrends); const points=trends.map((trend,i)=>{const angle=(i/Math.max(1,trends.length))*Math.PI*2-1.57, radius=45+score(trend.impact)*1.25; const x=50+Math.cos(angle)*Math.min(42,radius/4.5),y=50+Math.sin(angle)*Math.min(42,radius/4.5);return `<button class="radar-point" style="left:${x}%;top:${y}%"><span>${esc(trend.name)}</span><title>${esc(trend.description||'')}</title></button>`}).join('');
  return `<div class="grid two"><div class="radar"><span class="radar-label" style="top:8px;left:50%">TECH / POLICY</span><span class="radar-label" style="right:8px;top:50%">LONGER HORIZON</span><span class="radar-label" style="bottom:8px;left:50%">MARKET / SOCIETY</span><span class="radar-label" style="left:8px;top:50%">NEARER HORIZON</span>${points}</div><div class="card"><span class="kicker">MEGATREND INVENTORY</span>${trends.map(trend=>`<div class="opportunity"><div class="route-head"><h4>${esc(trend.name)}</h4><span class="tag">${esc(trend.stage||trend.horizon||'')}</span></div><p>${esc(trend.description)}</p><div class="score-row"><span>Impact</span><div class="score-bar"><span style="width:${score(trend.impact)}%"></span></div><b>${score(trend.impact)}</b></div><div class="score-row"><span>Velocity</span><div class="score-bar"><span style="width:${score(trend.velocity)}%"></span></div><b>${score(trend.velocity)}</b></div>${evidenceTags(trend.evidence_ids)}</div>`).join('')||'<p>メガトレンドはありません。</p>'}</div></div>`;
}

function whitespaceView(result) {
  const items=arr(result.whitespaces); const points=items.map((item,i)=>{const x=score(item.score?.feasibility??item.feasibility),y=score(item.score?.market_attractiveness??item.market_attractiveness),s=score(item.score?.evidence_strength??item.evidence_strength);return `<div class="matrix-point" style="left:${Math.max(4,x)}%;bottom:${Math.max(4,y)}%;width:${28+s/5}px;height:${28+s/5}px" title="${esc(item.name)}">${i+1}</div>`}).join('');
  return `<div class="grid two"><div class="card"><span class="kicker">OPPORTUNITY SPACE</span><h3>魅力度 × 実行可能性</h3><div class="matrix">${points}</div></div><div class="card"><span class="kicker">WHITESPACE RANKING</span><div class="opportunity-list">${items.map((item,i)=>`<article class="opportunity"><div class="route-head"><h4>${String(i+1).padStart(2,'0')} — ${esc(item.name)}</h4><span class="tag">${esc(item.customer||'buyer未特定')}</span></div><p><b>未充足：</b>${esc(item.pain)}</p><p><b>空白理由：</b>${esc(item.unmet_reason)}</p><p><b>機会：</b>${esc(item.opportunity)}</p><p><b>次の検証：</b>${esc(item.next_test)}</p>${evidenceTags(item.evidence_ids)}</article>`).join('')||'<p>ホワイトスペースはありません。</p>'}</div></div></div>`;
}

function profitView(result) {
  const pools=arr(result.profit_pools); const values=pools.map(item=>Number(item.revenue_pool)||score(item.pool_score)||50),max=Math.max(...values,1);
  return `<div class="card"><span class="kicker">VALUE CHAIN ECONOMICS</span><h3>利益プールと交渉力の移動</h3>${pools.map((item,i)=>{const dir=String(item.margin_direction||'').toLowerCase();return `<div class="pool-row"><div><b>${esc(item.value_chain_stage||item.name)}</b><small style="display:block;color:var(--muted)">${esc(item.name)}</small></div><div class="pool-track"><div class="pool-fill ${dir.includes('up')||dir.includes('上')?'up':dir.includes('down')||dir.includes('下')?'down':''}" style="width:${Math.max(6,values[i]/max*100)}%"></div></div><div class="pool-value">${esc(item.revenue_pool||item.pool_score||'n/a')}<br>${esc(item.margin_direction||'')}</div></div>`}).join('')||'<p>利益プールはありません。</p>'}</div><div class="grid three" style="margin-top:18px">${pools.map(item=>`<article class="card"><span class="kicker">${esc(item.value_chain_stage)}</span><h3>${esc(item.name)}</h3><p><b>獲得原理：</b>${esc(item.capture_mechanism)}</p><p><b>参入障壁：</b>${textList(item.barriers)}</p><p><b>勝者：</b>${textList(item.winners)}</p><p><b>敗者：</b>${textList(item.losers)}</p>${evidenceTags(item.evidence_ids)}</article>`).join('')}</div>`;
}

function routeCard(route,type) {
  const investment=type==='investment'; const chain=investment?[route.theme,route.transmission,textList(route.beneficiaries),route.expectations_gap,route.decision]:[route.structural_change,route.pain,route.buyer,route.solution,route.validation];
  return `<article class="card route"><div class="route-head"><div><span class="kicker">${investment?'INVESTMENT TRANSMISSION':'BUSINESS DESIGN'}</span><h3>${esc(route.name||route.theme||route.solution)}</h3></div><span class="route-decision">${esc(route.decision||route.pricing||'検証')}</span></div><div class="logic-chain">${chain.filter(Boolean).map((item,i)=>`${i?'<span class="logic-arrow">→</span>':''}<div class="logic-node">${esc(item)}</div>`).join('')}</div>${investment?`<p><b>Catalyst：</b>${textList(route.catalysts)}</p><p><b>Valuation：</b>${esc(route.valuation)}</p><p><b>Crowding：</b>${esc(route.crowding)}</p><div class="risk-box"><b>Downside：</b>${esc(route.downside)}</div>`:`<p><b>買い手 / 予算：</b>${esc(route.buyer)} / ${esc(route.budget)}</p><p><b>Unit economics：</b>${esc(route.unit_economics)}</p><p><b>Channel：</b>${esc(route.channel)}</p><div class="risk-box"><b>Kill criteria：</b>${esc(route.kill_criteria||route.risks)}</div>`}${evidenceTags(route.evidence_ids)}</article>`;
}
function investmentView(result){const routes=arr(result.investment_routes);return `<div class="grid two">${routes.map(route=>routeCard(route,'investment')).join('')||'<div class="empty-state"><h2>投資ルートなし</h2><p>投資判断を含まない依頼、または証拠不足です。</p></div>'}</div><div class="card" style="margin-top:18px"><span class="kicker">RISK BOUNDARY</span><p>これは自動売買システムではありません。期待差、バリュエーション、カタリスト、混雑、下方リスクを分離して判断材料にします。</p></div>`;}
function businessView(result){const routes=arr(result.business_routes);return `<div class="grid two">${routes.map(route=>routeCard(route,'business')).join('')||'<div class="empty-state"><h2>事業ルートなし</h2><p>事業判断を含まない依頼、または買い手・予算が未特定です。</p></div>'}</div>`;}

function scenariosView(result){const scenarios=arr(result.scenarios);return `<div class="grid three">${scenarios.map(item=>`<article class="card scenario"><span class="scenario-prob">${pct(item.probability)}%</span><span class="kicker">SCENARIO</span><h3>${esc(item.name)}</h3><p>${esc(item.narrative||item.description)}</p><p><b>主要軸：</b>${textList(item.axes)}</p><p><b>含意：</b>${textList(item.implications)}</p><div class="scenario-signals"><b>先行指標</b>${arr(item.indicators||item.signposts).map(x=>`<p>↳ ${esc(x)}</p>`).join('')}</div>${evidenceTags(item.evidence_ids)}</article>`).join('')||'<div class="empty-state"><h2>シナリオなし</h2></div>'}</div>`;}

function evidenceView(result){const items=arr(result.evidence);return `<div class="metric-strip"><div class="metric"><b>${items.filter(x=>x.source_tier==='primary').length}</b><span>PRIMARY</span></div><div class="metric"><b>${items.filter(x=>x.statement_type==='fact').length}</b><span>FACT</span></div><div class="metric"><b>${items.filter(x=>x.statement_type==='inference').length}</b><span>INFERENCE</span></div><div class="metric"><b>${items.filter(x=>x.source_tier==='synthetic').length}</b><span>SYNTHETIC</span></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>種別</th><th>出典</th><th>支える主張</th><th>限界 / 反証</th><th>日付</th></tr></thead><tbody>${items.map(item=>`<tr><td><code>${esc(item.id)}</code></td><td><span class="tier ${esc(item.source_tier)}">${esc(item.source_tier)}</span><br><span class="tag ${esc(item.statement_type)}">${esc(item.statement_type)}</span></td><td><a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a><br>${esc(item.publisher)}</td><td>${textList(item.supports)}</td><td>${esc(item.limitations||'—')} ${arr(item.counterevidence_ids).length?`<br>Counter: ${textList(item.counterevidence_ids)}`:''}</td><td>公開 ${formatDate(item.published_at)}<br>取得 ${formatDate(item.accessed_at)}</td></tr>`).join('')}</tbody></table></div>`;}

function forecastsView(result){
  const items=arr(result.forecasts), log=state.current?.forecast_log||{};
  return `<div class="card"><span class="kicker">FORECAST REGISTRY</span><h3>期限、確率、解像条件を持つ予測</h3>${items.map(item=>{const entry=log[item.id]||{},latest=entry.history?.at(-1)?.probability??(Number(item.probability)>1?Number(item.probability)/100:Number(item.probability));return `<article class="forecast"><div class="probability">${pct(latest)}%</div><div><h4>${esc(item.question)}</h4><p><b>Base rate：</b>${esc(item.base_rate)}</p><p>${esc(item.reasoning)}</p><p><b>上方：</b>${textList(item.up_factors)}　<b>下方：</b>${textList(item.down_factors)}</p><small>解像条件：${esc(item.resolution_criteria)}</small>${evidenceTags(item.evidence_ids)}${entry.resolution?`<p><span class="tag fact">RESOLVED ${entry.resolution.outcome?'YES':'NO'}</span> Brier: <b>${entry.resolution.brier_score}</b></p>`:`<div class="handoff-actions"><input id="forecast-${esc(item.id)}" type="number" min="0" max="100" value="${pct(latest)}" style="width:74px" aria-label="予測確率"><button class="small-button" data-forecast-update="${esc(item.id)}">確率更新</button><button class="small-button" data-forecast-resolve="${esc(item.id)}|1">YES解像</button><button class="small-button" data-forecast-resolve="${esc(item.id)}|0">NO解像</button></div>`}</div><time>RESOLVE<br>${formatDate(item.resolution_date)}<br>${arr(entry.history).length} UPDATES</time></article>`}).join('')||'<p>採点可能な予測はありません。</p>'}</div>`;
}

function connectorsView(){
  const all=state.connectors?.connectors||[], filter=state.connectorFilter, items=filter==='all'?all:all.filter(item=>item.state===filter||item.region.includes(filter)||item.domain.includes(filter));
  const filters=[['all','すべて'],['ready','すぐ使える'],['key_required','データキー必要'],['not_installed','MCP未導入'],['manual_import','手動取込'],['japan','日本'],['europe','欧州'],['china','中国'],['latin_america','中南米'],['africa','アフリカ']];
  return `<div class="card" style="margin-bottom:14px"><span class="kicker">CONNECTOR CONTROL PLANE</span><h3>AIキーとデータ接続は別物です</h3><p><b>ready</b> は追加AIキーなしで利用可能。<b>key_required</b> は情報提供元のデータキーが必要。MCP未導入や手動取込も隠さず表示します。</p></div><div class="connector-toolbar">${filters.map(([id,label])=>`<button class="filter-button ${filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div><div class="connector-grid">${items.map(item=>`<article class="connector"><span class="connector-state ${esc(item.state)}">● ${esc(item.state)}</span><h3>${esc(item.name)}</h3><p>${esc(item.provider)} · ${esc(item.transport)}</p><p>${textList(item.region)} / ${textList(item.domain)}</p>${item.role?`<p>${esc(item.role)}</p>`:''}${item.official?`<a href="${safeUrl(item.official)}" target="_blank" rel="noreferrer">公式ソース ↗</a>`:''}</article>`).join('')}</div>`;
}
function methodsView(){const methods=state.catalog?.methods||[];return `<div class="card dark" style="margin-bottom:14px"><span class="kicker">METHOD STACK</span><h3>一つの予測法に賭けず、外部視点・因果・シナリオ・反証を合成する</h3><p>各方法は名前だけでなく、用途と必須出力を実行契約に含めます。</p></div><div class="method-grid">${methods.map((item,i)=>`<article class="method"><span class="section-index">${String(i+1).padStart(2,'0')}</span><br><b>${esc(item.name)}</b><p>${esc(item.purpose)}</p><ol>${arr(item.outputs).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article>`).join('')}</div>`;}

init();
