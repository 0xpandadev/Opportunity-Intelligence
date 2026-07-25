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
  bindKnowledgeGraph();
  bindTrendRadar();
  bindWhitespaceExplorer();
  $$('#view-content [data-forecast-update]').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.forecastUpdate, input=$(`#forecast-${CSS.escape(id)}`), probability=Number(input.value)/100;
    try{state.current=await api(`/api/runs/${state.current.id}/forecasts/${encodeURIComponent(id)}/updates`,{method:'POST',body:JSON.stringify({probability,note:'GUI probability update'})});renderView();toast('予測確率を更新しました');}catch(error){toast(error.message);}
  }));
  $$('#view-content [data-forecast-resolve]').forEach(button=>button.addEventListener('click',async()=>{
    const [id,outcome]=button.dataset.forecastResolve.split('|');
    try{state.current=await api(`/api/runs/${state.current.id}/forecasts/${encodeURIComponent(id)}/resolve`,{method:'POST',body:JSON.stringify({outcome:Number(outcome),note:'GUI resolution'})});renderView();toast('予測を解像しBrier scoreを記録しました');}catch(error){toast(error.message);}
  }));
}

function bindKnowledgeGraph(){
  const svg=$('#knowledge-graph'); if(!svg) return;
  const world=svg.querySelector('[data-graph-world]'), nodes=[...svg.querySelectorAll('[data-graph-node]')], edges=[...svg.querySelectorAll('[data-graph-edge]')];
  const viewBox=svg.viewBox.baseVal, transform={x:0,y:0,k:1}; let gesture=null, moved=false;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const point=event=>{const rect=svg.getBoundingClientRect();return{x:(event.clientX-rect.left)*viewBox.width/rect.width,y:(event.clientY-rect.top)*viewBox.height/rect.height};};
  const worldPoint=event=>{const p=point(event);return{x:(p.x-transform.x)/transform.k,y:(p.y-transform.y)/transform.k};};
  const applyTransform=()=>world.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.k})`);
  const updateEdges=id=>edges.filter(edge=>edge.dataset.source===id||edge.dataset.target===id).forEach(edge=>{const source=svg.querySelector(`[data-graph-node="${CSS.escape(edge.dataset.source)}"]`),target=svg.querySelector(`[data-graph-node="${CSS.escape(edge.dataset.target)}"]`);if(!source||!target)return;edge.setAttribute('x1',source.dataset.x);edge.setAttribute('y1',source.dataset.y);edge.setAttribute('x2',target.dataset.x);edge.setAttribute('y2',target.dataset.y);});
  const selectNode=id=>{nodes.forEach(node=>node.classList.toggle('selected',node.dataset.graphNode===id));$$('[data-graph-detail]').forEach(detail=>detail.hidden=detail.dataset.graphDetail!==id);const selected=nodes.find(node=>node.dataset.graphNode===id);if(selected) $('#graph-selection-label').textContent=selected.dataset.label;};
  const reset=()=>{transform.x=0;transform.y=0;transform.k=1;nodes.forEach(node=>{node.dataset.x=node.dataset.initialX;node.dataset.y=node.dataset.initialY;node.setAttribute('transform',`translate(${node.dataset.x} ${node.dataset.y})`);updateEdges(node.dataset.graphNode);});applyTransform();};
  svg.addEventListener('pointerdown',event=>{const node=event.target.closest('[data-graph-node]');moved=false;if(node){const p=worldPoint(event);gesture={type:'node',node,startX:p.x,startY:p.y,nodeX:Number(node.dataset.x),nodeY:Number(node.dataset.y)};selectNode(node.dataset.graphNode);}else{const p=point(event);gesture={type:'pan',startX:p.x,startY:p.y,x:transform.x,y:transform.y};svg.classList.add('panning');}svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!gesture)return;const p=gesture.type==='node'?worldPoint(event):point(event);const dx=p.x-gesture.startX,dy=p.y-gesture.startY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;if(gesture.type==='node'){const x=clamp(gesture.nodeX+dx,42,viewBox.width-42),y=clamp(gesture.nodeY+dy,42,viewBox.height-42);gesture.node.dataset.x=x;gesture.node.dataset.y=y;gesture.node.setAttribute('transform',`translate(${x} ${y})`);updateEdges(gesture.node.dataset.graphNode);}else{transform.x=gesture.x+dx;transform.y=gesture.y+dy;applyTransform();}});
  const endGesture=()=>{gesture=null;svg.classList.remove('panning');}; svg.addEventListener('pointerup',endGesture);svg.addEventListener('pointercancel',endGesture);
  svg.addEventListener('wheel',event=>{event.preventDefault();const p=point(event),old=transform.k,next=clamp(old*(event.deltaY<0?1.12:.89),.45,2.8);transform.x=p.x-(p.x-transform.x)*(next/old);transform.y=p.y-(p.y-transform.y)*(next/old);transform.k=next;applyTransform();},{passive:false});
  nodes.forEach(node=>{node.addEventListener('click',()=>{if(!moved)selectNode(node.dataset.graphNode);});node.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectNode(node.dataset.graphNode);}});});
  $$('[data-graph-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.graphAction;if(action==='reset'||action==='fit')reset();else{const factor=action==='zoom-in'?1.2:.83,center={x:viewBox.width/2,y:viewBox.height/2},old=transform.k,next=clamp(old*factor,.45,2.8);transform.x=center.x-(center.x-transform.x)*(next/old);transform.y=center.y-(center.y-transform.y)*(next/old);transform.k=next;applyTransform();}}));
  $$('[data-graph-filter]').forEach(button=>button.addEventListener('click',()=>{const type=button.dataset.graphFilter;$$('[data-graph-filter]').forEach(item=>item.classList.toggle('active',item===button));const visible=new Set();nodes.forEach(node=>{const show=type==='all'||node.dataset.type===type;node.classList.toggle('filtered-out',!show);if(show)visible.add(node.dataset.graphNode);});edges.forEach(edge=>edge.classList.toggle('filtered-out',!visible.has(edge.dataset.source)||!visible.has(edge.dataset.target)));}));
  if(nodes[0]) selectNode(nodes[0].dataset.graphNode);
}

function bindTrendRadar(){
  const points=$$('[data-trend-index]'); if(!points.length) return;
  const select=index=>{points.forEach(point=>{const active=point.dataset.trendIndex===index;point.classList.toggle('selected',active);point.setAttribute('aria-pressed',String(active));});$$('[data-trend-card]').forEach(card=>card.classList.toggle('selected',card.dataset.trendCard===index));};
  points.forEach(point=>point.addEventListener('click',()=>{select(point.dataset.trendIndex);document.querySelector(`[data-trend-card="${CSS.escape(point.dataset.trendIndex)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}));
  $$('[data-trend-card]').forEach(card=>card.addEventListener('click',()=>select(card.dataset.trendCard))); select('0');
}

function bindWhitespaceExplorer(){
  const controls=$$('[data-whitespace-index]'); if(!controls.length) return;
  const select=index=>{controls.forEach(control=>{const active=control.dataset.whitespaceIndex===index;control.classList.toggle('selected',active);control.setAttribute('aria-pressed',String(active));});$$('[data-whitespace-detail]').forEach(detail=>detail.hidden=detail.dataset.whitespaceDetail!==index);};
  controls.forEach(control=>control.addEventListener('click',()=>select(control.dataset.whitespaceIndex))); select('0');
}

function metricStrip(result){return `<div class="metric-strip"><div class="metric"><b>${arr(result.megatrends).length}</b><span>MEGATRENDS</span></div><div class="metric"><b>${arr(result.whitespaces).length}</b><span>WHITESPACES</span></div><div class="metric"><b>${arr(result.evidence).length}</b><span>EVIDENCE ITEMS</span></div><div class="metric"><b>${arr(result.forecasts).length}</b><span>SCORED FORECASTS</span></div></div>`;}

function executiveView(result) {
  const ex=result.executive||{};
  return `${metricStrip(result)}<div class="grid two"><article class="card dark"><span class="kicker">EXECUTIVE CONCLUSION</span><div class="decision-line">${esc(ex.one_line)}</div><p>${esc(ex.decision)}</p><div class="confidence"><span>CONFIDENCE ${pct(ex.confidence)}%</span><div class="confidence-track"><span style="width:${pct(ex.confidence)}%"></span></div></div></article><article class="card"><span class="kicker">DECISION SPINE</span><div class="spine">${arr(ex.decision_spine).map(item=>`<div class="spine-item"><div><strong>${esc(item.step||item.claim)}</strong><small>${esc(item.claim||'')}</small>${evidenceTags(item.evidence_ids)}</div></div>`).join('')||'<p>Decision Spineはありません。</p>'}</div></article></div><div class="grid two" style="margin-top:18px"><article class="card"><span class="kicker">WHY NOW</span><h3>いま動く根拠</h3>${arr(ex.why_now).map(item=>`<p>→ ${esc(item)}</p>`).join('')||'<p>—</p>'}</article><article class="card"><span class="kicker">WATCHOUTS</span><h3>反証・注意点</h3>${arr(ex.watchouts).map(item=>`<p>× ${esc(item)}</p>`).join('')}${arr(result.counterarguments).slice(0,4).map(item=>`<p>× ${esc(item.claim||item)}</p>`).join('')}</article></div>`;
}

function transformationView(result) {
  const graph=result.knowledge_graph||{nodes:[],edges:[]}, nodes=arr(graph.nodes).slice(0,36), edges=arr(graph.edges).filter(edge=>nodes.some(n=>n.id===edge.source)&&nodes.some(n=>n.id===edge.target));
  if(!nodes.length)return '<div class="empty-state"><h2>変革マップはありません</h2><p>因果ノードと関係が生成されると、ここで探索できます。</p></div>';
  const W=1200,H=680,cx=W/2,cy=H/2,colors={trend:'#d7e54a',driver:'#29a3a9',risk:'#e14b3d',sector:'#e0a035',company:'#b9a7e8',policy:'#6fbc7c',technology:'#71a9df',evidence:'#9aa098'};
  const degree=new Map(nodes.map(node=>[node.id,edges.filter(edge=>edge.source===node.id||edge.target===node.id).length])), ordered=[...nodes].sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0));
  const positions=new Map(ordered.map((node,i)=>{if(i===0)return[node.id,{x:cx,y:cy}];const ring=i<=6?1:i<=18?2:3,start=ring===1?1:ring===2?7:19,count=ring===1?6:ring===2?12:Math.max(1,ordered.length-19),slot=i-start,angle=(slot/Math.max(1,count))*Math.PI*2-(Math.PI/2)+(ring*.12),radius=ring===1?170:ring===2?290:385;return[node.id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius}]}));
  const edgeSvg=edges.map((edge,i)=>{const a=positions.get(edge.source),b=positions.get(edge.target);return `<line data-graph-edge="${i}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" class="graph-edge ${edge.polarity==='negative'?'negative':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${Math.max(1,Number(edge.weight||.5)*4)}"><title>${esc(edge.type)} / ${esc(edge.polarity||'positive')}</title></line>`}).join('');
  const nodeSvg=nodes.map(node=>{const p=positions.get(node.id),r=10+score(node.confidence)/17;return `<g role="button" tabindex="0" aria-label="${esc(node.label)}、${esc(node.type)}、信頼度${score(node.confidence)}" data-graph-node="${esc(node.id)}" data-label="${esc(node.label)}" data-type="${esc(node.type)}" data-x="${p.x}" data-y="${p.y}" data-initial-x="${p.x}" data-initial-y="${p.y}" class="graph-node" transform="translate(${p.x} ${p.y})"><circle r="${r}" fill="${colors[node.type]||'#e7e5dc'}"></circle><text x="${r+8}" y="4">${esc(node.label)}</text></g>`}).join('');
  const types=[...new Set(nodes.map(node=>node.type).filter(Boolean))];
  const details=nodes.map(node=>{const connected=edges.filter(edge=>edge.source===node.id||edge.target===node.id);return `<section class="graph-detail" data-graph-detail="${esc(node.id)}" hidden><span class="node-type" style="--node-color:${colors[node.type]||'#e7e5dc'}">${esc(node.type)}</span><h3>${esc(node.label)}</h3><div class="graph-confidence"><span>信頼度</span><b>${score(node.confidence)}</b><div><i style="width:${score(node.confidence)}%"></i></div></div><p class="graph-detail-label">接続 ${connected.length}件</p>${connected.slice(0,8).map(edge=>{const other=edge.source===node.id?nodes.find(n=>n.id===edge.target):nodes.find(n=>n.id===edge.source);return `<p class="graph-relation"><b>${esc(edge.type)}</b><span>${esc(other?.label||'')}</span></p>`}).join('')||'<p>接続関係はありません。</p>'}${evidenceTags(node.evidence_ids)}</section>`}).join('');
  return `<section class="graph-explorer"><div class="graph-toolbar"><div><span class="kicker">INTERACTIVE CAUSAL MAP</span><h2>変化の因果を、触って探索する</h2><p>ホイールで拡大縮小、余白をドラッグして移動、ノードをドラッグして関係をほどけます。</p></div><div class="graph-actions"><button data-graph-action="zoom-out" aria-label="縮小">−</button><button data-graph-action="zoom-in" aria-label="拡大">＋</button><button data-graph-action="fit">全体表示</button><button data-graph-action="reset">配置を戻す</button></div></div><div class="graph-filters"><button class="active" data-graph-filter="all">すべて ${nodes.length}</button>${types.map(type=>`<button data-graph-filter="${esc(type)}"><i style="--node-color:${colors[type]||'#e7e5dc'}"></i>${esc(type)} ${nodes.filter(node=>node.type===type).length}</button>`).join('')}</div><div class="graph-stage"><div class="graph-wrap"><svg id="knowledge-graph" viewBox="0 0 ${W} ${H}" role="application" aria-label="動的な変革・ナレッジグラフ"><g data-graph-world>${edgeSvg}${nodeSvg}</g></svg><div class="graph-legend">赤線＝抑制・悪化　線の太さ＝影響の強さ</div></div><aside class="graph-inspector"><span class="kicker">SELECTED NODE</span><p id="graph-selection-label" class="graph-selection-label">ノードを選択</p>${details}</aside></div></section><div class="grid two graph-summary"><div class="card"><span class="kicker">SYSTEM LOGIC</span><h3>主要な因果関係</h3>${edges.slice(0,10).map(edge=>`<p><b>${esc(nodes.find(n=>n.id===edge.source)?.label||edge.source)}</b> → ${esc(edge.type)} → <b>${esc(nodes.find(n=>n.id===edge.target)?.label||edge.target)}</b></p>`).join('')||'<p>グラフの関係はありません。</p>'}</div><div class="card"><span class="kicker">GRAPH QUALITY</span><h3>証拠との接続</h3><p><b>${nodes.filter(n=>arr(n.evidence_ids).length).length} / ${nodes.length}</b> ノードに証拠参照があります。</p><p>合成シナリオは <span class="tag synthetic">synthetic</span> として一次事実から分離します。</p></div></div>`;
}

function megatrendsView(result) {
  const trends=arr(result.megatrends); if(!trends.length)return '<div class="empty-state"><h2>メガトレンドはありません</h2></div>';
  const points=trends.map((trend,i)=>{const x=Math.max(8,Math.min(92,score(trend.velocity))),y=Math.max(8,Math.min(92,score(trend.impact)));return `<button class="radar-point" data-trend-index="${i}" aria-label="${i+1} ${esc(trend.name)}、影響${score(trend.impact)}、速度${score(trend.velocity)}" style="left:${x}%;bottom:${y}%"><span>${i+1}</span></button>`}).join('');
  return `<section class="megatrend-layout"><article class="card radar-card"><div class="visual-heading"><div><span class="kicker">MEGATREND RADAR</span><h2>影響度 × 変化速度</h2></div><p>右上ほど「影響が大きく、進行も速い」。番号を選ぶと右の詳細と対応します。</p></div><div class="radar"><div class="radar-quadrant monitor">観測</div><div class="radar-quadrant bet">先行投資</div><div class="radar-quadrant prepare">能力構築</div><div class="radar-quadrant act">今すぐ対応</div><span class="radar-axis radar-axis-x">変化速度　低 → 高</span><span class="radar-axis radar-axis-y">影響度　低 → 高</span>${points}</div><div class="radar-index">${trends.map((trend,i)=>`<button data-trend-index="${i}"><b>${i+1}</b><span>${esc(trend.name)}</span></button>`).join('')}</div></article><article class="card trend-inventory"><span class="kicker">MEGATREND INVENTORY</span>${trends.map((trend,i)=>`<button class="trend-card" data-trend-card="${i}"><div class="trend-card-head"><b><i>${i+1}</i>${esc(trend.name)}</b><span class="tag">${esc(trend.stage||trend.horizon||'')}</span></div><p>${esc(trend.description)}</p><div class="score-row"><span>Impact</span><div class="score-bar"><span style="width:${score(trend.impact)}%"></span></div><b>${score(trend.impact)}</b></div><div class="score-row"><span>Velocity</span><div class="score-bar"><span style="width:${score(trend.velocity)}%"></span></div><b>${score(trend.velocity)}</b></div>${evidenceTags(trend.evidence_ids)}</button>`).join('')}</article></section>`;
}

function whitespaceView(result) {
  const items=arr(result.whitespaces); if(!items.length)return '<div class="empty-state"><h2>ホワイトスペースはありません</h2></div>';
  const points=items.map((item,i)=>{const x=score(item.score?.feasibility??item.feasibility),y=score(item.score?.market_attractiveness??item.market_attractiveness),s=score(item.score?.evidence_strength??item.evidence_strength);return `<button class="matrix-point" data-whitespace-index="${i}" aria-label="${i+1} ${esc(item.name)}、魅力度${y}、実行可能性${x}、証拠${s}" style="left:${Math.max(7,Math.min(93,x))}%;bottom:${Math.max(7,Math.min(93,y))}%;--point-size:${34+s/6}px"><span>${i+1}</span></button>`}).join('');
  const ranking=items.map((item,i)=>{const attractive=score(item.score?.market_attractiveness??item.market_attractiveness),feasible=score(item.score?.feasibility??item.feasibility);return `<button class="whitespace-rank" data-whitespace-index="${i}"><i>${String(i+1).padStart(2,'0')}</i><span><b>${esc(item.name)}</b><small>${esc(item.customer||'顧客未特定')}</small></span><strong>${Math.round((attractive+feasible)/2)}</strong></button>`}).join('');
  const details=items.map((item,i)=>{const attractive=score(item.score?.market_attractiveness??item.market_attractiveness),feasible=score(item.score?.feasibility??item.feasibility),evidence=score(item.score?.evidence_strength??item.evidence_strength);return `<article class="whitespace-detail" data-whitespace-detail="${i}" hidden><div class="whitespace-detail-head"><div><span class="kicker">WHITESPACE ${String(i+1).padStart(2,'0')}</span><h2>${esc(item.name)}</h2></div><span class="whitespace-composite">総合<br><b>${Math.round((attractive+feasible+evidence)/3)}</b></span></div><div class="whitespace-scores"><span>魅力度 <b>${attractive}</b></span><span>実行可能性 <b>${feasible}</b></span><span>証拠強度 <b>${evidence}</b></span></div><dl class="whitespace-story"><div><dt>誰が困っているか</dt><dd>${esc(item.customer||'顧客未特定')}</dd></div><div><dt>未充足の痛み</dt><dd>${esc(item.pain)}</dd></div><div><dt>なぜ空白なのか</dt><dd>${esc(item.unmet_reason)}</dd></div><div class="opportunity-answer"><dt>何を作ればよいか</dt><dd>${esc(item.opportunity)}</dd></div><div class="next-test"><dt>最小の次の検証</dt><dd>${esc(item.next_test)}</dd></div></dl>${evidenceTags(item.evidence_ids)}</article>`}).join('');
  return `<section class="whitespace-intro"><div><span class="kicker">HOW TO READ</span><h2>空いている市場ではなく、解けていない高価な痛みを探す</h2></div><ol><li><b>位置</b><span>右上ほど魅力的で実行しやすい</span></li><li><b>大きさ</b><span>円が大きいほど証拠が強い</span></li><li><b>選択</b><span>番号を押して機会仮説と検証を読む</span></li></ol></section><section class="whitespace-layout"><article class="card whitespace-map-card"><div class="visual-heading"><div><span class="kicker">OPPORTUNITY SPACE</span><h2>魅力度 × 実行可能性</h2></div><p>右上だけを追わず、証拠の弱い候補は追加検証します。</p></div><div class="matrix"><span class="matrix-quadrant top-left">魅力大・実行難</span><span class="matrix-quadrant top-right">優先検証</span><span class="matrix-quadrant bottom-left">保留</span><span class="matrix-quadrant bottom-right">小さく試す</span>${points}</div><div class="whitespace-ranking"><span class="kicker">RANKING</span>${ranking}</div></article><div class="whitespace-detail-panel">${details}</div></section>`;
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
