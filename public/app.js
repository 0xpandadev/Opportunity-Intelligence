const state = { catalog:null, connectors:null, runs:[], current:null, tab:'executive', connectorFilter:'available', polling:null };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const tabs = [
  ['executive','結論'],['transformation','変革マップ'],['megatrends','メガトレンド'],['whitespace','ホワイトスペース'],
  ['profit','利益プール'],['investment','投資ルート'],['business','事業ルート'],['scenarios','シナリオ'],
  ['simulation','シミュレーション'],['evidence','証拠台帳'],['forecasts','予測台帳'],['connectors','データ接続'],['methods','方法論']
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
function normalize(value='') { return String(value || '').toLowerCase(); }

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
    const remove=event.target.closest('[data-delete-run]'); if(remove) await deleteRun(remove.dataset.deleteRun);
  });
}

function renderRuns() {
  $('#run-list').innerHTML=state.runs.length ? state.runs.map(run=>`<div class="run-entry ${state.current?.id===run.id?'active':''}"><button class="run-button" data-run="${esc(run.id)}"><strong>${esc(run.title)}</strong><span><i>${esc(run.status?.state||'unknown')}</i><time>${formatDate(run.created_at)}</time></span></button><button class="run-delete" data-delete-run="${esc(run.id)}" aria-label="${esc(run.title)}を削除" title="分析を削除">×</button></div>`).join('') : '<div class="run-empty">まだ分析はありません</div>';
  $$('#run-list [data-run]').forEach(button=>button.addEventListener('click',()=>openRun(button.dataset.run)));
  $$('#run-list [data-delete-run]').forEach(button=>button.addEventListener('click',()=>deleteRun(button.dataset.deleteRun)));
}

async function deleteRun(id) {
  const run=state.runs.find(item=>item.id===id); if(!run) return;
  if(!window.confirm(`「${run.title}」を削除しますか？\n削除後もローカルのごみ箱から復元できます。`)) return;
  try {
    await api(`/api/runs/${encodeURIComponent(id)}`,{method:'DELETE'});
    state.runs=state.runs.filter(item=>item.id!==id);
    const wasCurrent=state.current?.id===id; if(wasCurrent) state.current=null;
    renderRuns(); toast('分析を削除しました');
    if(wasCurrent){ if(state.runs[0]) await openRun(state.runs[0].id,true); else showComposer(); }
  } catch(error) { toast(`削除できません: ${error.message}`); }
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
    clearInterval(state.polling); if(state.current.status?.state==='pending_codex'||['pending_codex','running'].includes(state.current.simulation?.status?.state)) state.polling=setInterval(()=>openRun(id,true),5000);
    if(!quiet) window.scrollTo({top:0,behavior:'smooth'});
  } catch(error) { toast(`分析を開けません: ${error.message}`); }
}

function renderStatus() {
  const run=state.current, status=run.status?.state||'unknown', complete=status==='complete';
  const prompt=`Opportunity Intelligence の保留中run ${run.id} を、run-decision-intelligenceスキルで実行して。`;
  $('#run-status').innerHTML=`<div class="run-status-card"><div><span class="kicker">RUN ${esc(run.id)}</span><h2>${esc(run.request.query)}</h2><p>${textList(run.request.regions)} · ${textList(run.request.sectors)} · ${esc(run.request.horizon)}</p>${!complete?`<div class="handoff"><strong>次の工程：Codexで実データ分析</strong><p>依頼は保存済みです。追加AI APIキーは不要ですが、Codexデスクトップで下の依頼を実行してください。ブラウザだけでAI処理済みとは表示しません。</p><code>${esc(prompt)}</code><div class="handoff-actions"><button class="small-button primary" data-copy="${esc(prompt)}">依頼文をコピー</button><button class="small-button" data-refresh>結果を確認</button></div></div>`:''}</div><div class="status-actions"><span class="status-badge ${esc(status)}">${esc(status)}</span><button class="small-button danger" data-delete-run="${esc(run.id)}">この分析を削除</button></div></div>`;
}

function renderTabs() {
  $('#view-tabs').innerHTML=tabs.map(([id,label])=>`<button class="tab-button ${state.tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('');
}

function renderView() {
  const root=$('#view-content'), result=state.current?.result;
  if(['connectors','methods'].includes(state.tab)){ root.innerHTML=state.tab==='connectors'?connectorsView():methodsView(); bindDynamic(); return; }
  if(!result){ root.innerHTML=`<div class="empty-state"><span class="section-index">ANALYSIS PENDING</span><h2>結果はまだ生成されていません</h2><p>依頼は失われていません。上のCodex用依頼を実行すると、検証済みJSONを読み込んで全ビューが有効になります。</p></div>`; return; }
  const renderers={executive:executiveView,transformation:transformationDecisionView,megatrends:megatrendsDecisionView,whitespace:whitespaceDecisionView,profit:profitDecisionView,investment:investmentView,business:businessView,scenarios:scenariosView,simulation:simulationView,evidence:evidenceView,forecasts:forecastsView};
  root.dataset.view=state.tab; root.innerHTML=(renderers[state.tab]||executiveView)(result); bindDynamic();
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
  const simulationRequest=$('#simulation-request');
  if(simulationRequest) simulationRequest.addEventListener('click',async()=>{
    simulationRequest.disabled=true;
    try{
      const agentCount=Number($('#simulation-agent-count')?.value||10), rounds=Number($('#simulation-round-count')?.value||6), objective=$('#simulation-objective')?.value||'';
      state.current=await api(`/api/runs/${encodeURIComponent(state.current.id)}/simulation/request`,{method:'POST',body:JSON.stringify({agent_count:agentCount,rounds,objective})});
      renderView(); toast('Codexシミュレーション依頼をrun内に作成しました');
    }catch(error){toast(`依頼を作成できません: ${error.message}`);}
    finally{simulationRequest.disabled=false;}
  });
  const simulationCopy=$('[data-copy-simulation]');
  if(simulationCopy) simulationCopy.addEventListener('click',async()=>{await navigator.clipboard.writeText(simulationCopy.dataset.copySimulation);toast('Codex実行依頼をコピーしました');});
  const simulationRefresh=$('[data-simulation-refresh]');
  if(simulationRefresh) simulationRefresh.addEventListener('click',async()=>{state.current=await api(`/api/runs/${encodeURIComponent(state.current.id)}`);renderView();toast('シミュレーション状態を更新しました');});
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
  const select=index=>{points.forEach(point=>{const active=point.dataset.trendIndex===index;point.classList.toggle('selected',active);point.setAttribute('aria-pressed',String(active));});$$('[data-trend-card]').forEach(card=>card.classList.toggle('selected',card.dataset.trendCard===index));$$('[data-trend-detail]').forEach(detail=>detail.hidden=detail.dataset.trendDetail!==index);};
  points.forEach(point=>point.addEventListener('click',()=>{select(point.dataset.trendIndex);document.querySelector(`[data-trend-card="${CSS.escape(point.dataset.trendIndex)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}));
  $$('[data-trend-card]').forEach(card=>card.addEventListener('click',()=>select(card.dataset.trendCard))); select('0');
}

function bindWhitespaceExplorer(){
  const controls=$$('[data-whitespace-index]'); if(!controls.length) return;
  const select=index=>{controls.forEach(control=>{const active=control.dataset.whitespaceIndex===index;control.classList.toggle('selected',active);control.setAttribute('aria-pressed',String(active));});$$('[data-whitespace-detail]').forEach(detail=>detail.hidden=detail.dataset.whitespaceDetail!==index);};
  controls.forEach(control=>control.addEventListener('click',()=>select(control.dataset.whitespaceIndex))); select('0');
}

function metricStrip(result){return `<div class="metric-strip"><div class="metric"><b>${arr(result.megatrends).length}</b><span>MEGATRENDS</span></div><div class="metric"><b>${arr(result.whitespaces).length}</b><span>WHITESPACES</span></div><div class="metric"><b>${arr(result.evidence).length}</b><span>EVIDENCE ITEMS</span></div><div class="metric"><b>${arr(result.forecasts).length}</b><span>SCORED FORECASTS</span></div></div>`;}

function connectorMatchForEvidence(evidence, connectors) {
  const haystack=normalize(`${evidence.publisher} ${evidence.url} ${evidence.title}`);
  const matches={
    world_bank:['world bank','worldbank.org','data360'],
    eurostat:['eurostat','ec.europa.eu/eurostat'],
    crossref:['crossref','doi.org'],
    github_public:['github.com'],
    faostat:['fao','faostat'],
    unido:['unido'],
    usgs:['u.s. geological survey','usgs.gov'],
    materials_project:['materials project'],
    epo:['epo','european patent office'],
    reddit:['reddit.com'],
    sec_edgar_mcp:['sec','edgar','sec.gov'],
    edinet_mcp:['edinet'],
    datagov_mcp:['data.gov'],
    cinii_mcp:['cinii'],
    qiita_mcp:['qiita']
  };
  const matchedId=Object.entries(matches).find(([,needles])=>needles.some(needle=>haystack.includes(needle)))?.[0];
  return connectors.find(connector=>connector.id===matchedId) || null;
}

function relevantConnectorDomains(run) {
  const text=normalize(`${run?.request?.query || ''} ${textList(run?.request?.sectors)} ${textList(run?.request?.decision_types)}`);
  const domains=new Set(['macro','industry','technology','academic']);
  if(/semiconductor|半導体|chip|memory|hbm|nand|dram|材料|material|mineral|鉱物/.test(text)) ['materials','minerals','manufacturing','energy','patents','company filings','finance','regulation'].forEach(x=>domains.add(x));
  if(/農業|agri|food|食料/.test(text)) ['agriculture','food','land','climate'].forEach(x=>domains.add(x));
  if(/不動産|real estate|地理|立地/.test(text)) ['real estate','geospatial','hazards'].forEach(x=>domains.add(x));
  if(/人口|移民|外国人|在留|留学生|migration|population|demograph/.test(text)) ['population','migration','foreign residents','demographics','remittances'].forEach(x=>domains.add(x));
  if(/生活|消費|物価|インフレ|小売|consumer|retail|inflation|cost of living/.test(text)) ['consumer prices','household consumption','cost of living','retail','housing','land'].forEach(x=>domains.add(x));
  if(/資金|資本|送金|海外投資|外国投資|国際収支|FDI|capital flow|remittance|money flow/.test(text)) ['capital flows','foreign investment','balance of payments','remittances','money'].forEach(x=>domains.add(x));
  if(/新設|倒産|廃業|事業承継|M&A|企業関係|親会社|子会社|法人|insolvency|bankrupt|succession|ownership/.test(text)) ['new companies','insolvency','company status','corporate relationships','ownership','company registry','legal entities'].forEach(x=>domains.add(x));
  if(/法務|規制|compliance|労務|税|legal|law/.test(text)) ['law','regulation','tax','labor law','compliance','policy','courts'].forEach(x=>domains.add(x));
  if(/投資|株|finance|valuation|sec|edinet|財務/.test(text)) ['finance','valuation','company filings','insiders'].forEach(x=>domains.add(x));
  if(/reddit|sns|community|顧客|pain|weak signal/.test(text)) ['communities','customer pain','weak signals'].forEach(x=>domains.add(x));
  return domains;
}

function runDataLineageView() {
  const result=state.current?.result, all=state.connectors?.connectors||[];
  if(!result) return '';
  const evidence=arr(result.evidence);
  const matched=evidence.map(item=>{const connectorId=item.connector_id||item.acquisition?.connector_id;return {evidence:item,connector:connectorId?all.find(connector=>connector.id===connectorId):null};});
  const byConnector=matched.filter(item=>item.connector).reduce((map,item)=>map.set(item.connector.id,{connector:item.connector,count:(map.get(item.connector.id)?.count||0)+1}),new Map());
  const webOnly=matched.filter(item=>!item.connector && item.evidence.source_tier!=='synthetic');
  const synthetic=evidence.filter(item=>item.source_tier==='synthetic');
  const domains=relevantConnectorDomains(state.current);
  const relevant=all.filter(item=>arr(item.domain).some(domain=>domains.has(domain)));
  const readyRelevant=relevant.filter(item=>item.state==='ready');
  const setupRelevant=relevant.filter(item=>item.state!=='ready');
  const tierCount=tier=>evidence.filter(item=>item.source_tier===tier).length;
  const connectorRows=[...byConnector.values()].map(item=>`<div class="lineage-row"><b>${esc(item.connector.name)}</b><span>${item.count}件 · 実取得記録あり</span></div>`).join('');
  const gapRows=setupRelevant.slice(0,8).map(item=>`<div class="lineage-row gap"><b>${esc(item.name)}</b><span>${esc(item.state)} · ${esc(arr(item.domain).join(' / '))}</span></div>`).join('');
  return `<section class="run-data-lineage"><div class="lineage-head"><div><span class="kicker">RUN DATA LINEAGE</span><h2>この判断に使ったデータと、接続状態</h2><p>「ツールとして接続済み」と「このrunで実際に取得した」は別です。証拠に connector_id が保存された場合だけ、コネクタ由来として数えます。</p></div><div class="lineage-score"><b>${evidence.length}</b><span>このrunの証拠</span></div></div><div class="lineage-grid"><article><span class="lineage-label">今回実際に使った証拠</span><div class="lineage-metrics"><span><b>${tierCount('primary')}</b> primary</span><span><b>${tierCount('industry')}</b> industry</span><span><b>${tierCount('official_secondary')}</b> official</span><span><b>${tierCount('synthetic')}</b> synthetic</span></div><p>証拠台帳に入ったURL・出版社・日付をもとに判断へ接続しています。</p></article><article><span class="lineage-label">コネクタ経由の実取得</span>${connectorRows || '<p>このrunには connector_id 付きの取得記録がありません。Web調査で取得した証拠を、接続済みMCP由来とは表示しません。</p>'}</article><article><span class="lineage-label">今回のお題で強化余地がある接続</span>${gapRows || '<p>このお題に強く関係する未接続MCPは検出されませんでした。</p>'}</article></div><div class="lineage-foot"><span>常設で今すぐ使える関連接続: ${readyRelevant.length}</span><span>設定すれば強化できる関連接続: ${setupRelevant.length}</span><span>Web/一次情報として取得: ${webOnly.length}</span><span>合成シミュレーション: ${synthetic.length}</span></div></section>`;
}

function legacyExecutiveView(result) {
  const ex=result.executive||{};
  const evidence=arr(result.evidence), primary=evidence.filter(item=>item.source_tier==='primary').length, facts=evidence.filter(item=>item.statement_type==='fact').length;
  const confidence=pct(ex.confidence);
  const decisionSpine=arr(ex.decision_spine).slice(0,5).map((item,index)=>`<div class="exec-step"><span>${String(index+1).padStart(2,'0')}</span><div><b>${esc(item.step||'判断')}</b><p>${esc(item.claim||item.step||'')}</p>${evidenceTags(item.evidence_ids)}</div></div>`).join('');
  const whyNow=arr(ex.why_now).slice(0,4).map(item=>`<li>${esc(item)}</li>`).join('');
  const watchouts=[...arr(ex.watchouts),...arr(result.counterarguments).map(item=>item.claim||item)].slice(0,5).map(item=>`<li>${esc(item)}</li>`).join('');
  return `<section class="exec-brief"><div class="exec-brief-main"><span class="kicker">EXECUTIVE CONCLUSION</span><h2>${esc(ex.one_line)}</h2><p>${esc(ex.decision)}</p><div class="exec-actions"><span>Recommended posture</span><b>${confidence>=75?'Act / scale':confidence>=55?'Stage-gate':confidence>=35?'Watch and test':'Hold'}</b></div></div><aside class="exec-brief-side"><div class="exec-confidence"><span>CONFIDENCE</span><b>${confidence}%</b><i style="--confidence:${confidence}%"></i></div><div class="exec-kpis"><span><b>${arr(result.megatrends).length}</b>Megatrends</span><span><b>${arr(result.whitespaces).length}</b>Whitespaces</span><span><b>${evidence.length}</b>Evidence</span><span><b>${primary}</b>Primary</span><span><b>${facts}</b>Facts</span><span><b>${arr(result.forecasts).length}</b>Forecasts</span></div></aside></section><section class="exec-board"><article class="exec-panel spine-panel"><div class="exec-panel-head"><span class="kicker">DECISION SPINE</span><h3>結論までのロジック</h3></div>${decisionSpine || '<p>Decision Spineはありません。</p>'}</article><article class="exec-panel"><div class="exec-panel-head"><span class="kicker">WHY NOW</span><h3>今動く根拠</h3></div><ol class="exec-list positive">${whyNow || '<li>—</li>'}</ol></article><article class="exec-panel risk-panel"><div class="exec-panel-head"><span class="kicker">WATCHOUTS</span><h3>反証・注意点</h3></div><ol class="exec-list negative">${watchouts || '<li>—</li>'}</ol></article></section>`;
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
  const hubs=ordered.slice(0,5).map(node=>`<span>${esc(node.label)} <b>${degree.get(node.id)||0}</b></span>`).join('');
  return `${runDataLineageView()}<section class="graph-reading"><article><span class="kicker">READING RULE</span><h3>ドット密集は「空白」ではなく、争点の集中</h3><p>接続が多いノードは、需要・規制・供給・技術がぶつかる場所です。そこはチャンスの源泉にもなりますが、同時に混雑・制約・実行リスクも高い。ホワイトスペース判定は次のタブで別に行います。</p></article><article><span class="kicker">CURRENT HOTSPOTS</span><div class="hub-list">${hubs}</div></article></section><section class="graph-explorer"><div class="graph-toolbar"><div><span class="kicker">INTERACTIVE CAUSAL MAP</span><h2>変化の因果を、触って探索する</h2><p>ホイールで拡大縮小、余白をドラッグして移動、ノードをドラッグして関係をほどけます。</p></div><div class="graph-actions"><button data-graph-action="zoom-out" aria-label="縮小">−</button><button data-graph-action="zoom-in" aria-label="拡大">＋</button><button data-graph-action="fit">全体表示</button><button data-graph-action="reset">配置を戻す</button></div></div><div class="graph-filters"><button class="active" data-graph-filter="all">すべて ${nodes.length}</button>${types.map(type=>`<button data-graph-filter="${esc(type)}"><i style="--node-color:${colors[type]||'#e7e5dc'}"></i>${esc(type)} ${nodes.filter(node=>node.type===type).length}</button>`).join('')}</div><div class="graph-stage"><div class="graph-wrap"><svg id="knowledge-graph" viewBox="0 0 ${W} ${H}" role="application" aria-label="動的な変革・ナレッジグラフ"><g data-graph-world>${edgeSvg}${nodeSvg}</g></svg><div class="graph-legend">赤線＝抑制・悪化　線の太さ＝影響の強さ　大きい点＝信頼度が高い</div></div><aside class="graph-inspector"><span class="kicker">SELECTED NODE</span><p id="graph-selection-label" class="graph-selection-label">ノードを選択</p>${details}</aside></div></section><div class="grid two graph-summary"><div class="card"><span class="kicker">SYSTEM LOGIC</span><h3>主要な因果関係</h3>${edges.slice(0,10).map(edge=>`<p><b>${esc(nodes.find(n=>n.id===edge.source)?.label||edge.source)}</b> → ${esc(edge.type)} → <b>${esc(nodes.find(n=>n.id===edge.target)?.label||edge.target)}</b></p>`).join('')||'<p>グラフの関係はありません。</p>'}</div><div class="card"><span class="kicker">GRAPH QUALITY</span><h3>証拠との接続</h3><p><b>${nodes.filter(n=>arr(n.evidence_ids).length).length} / ${nodes.length}</b> ノードに証拠参照があります。</p><p>合成シナリオは <span class="tag synthetic">synthetic</span> として一次事実から分離します。</p></div></div>`;
}

function legacyMegatrendsView(result) {
  const trends=arr(result.megatrends); if(!trends.length)return '<div class="empty-state"><h2>メガトレンドはありません</h2></div>';
  const points=trends.map((trend,i)=>{const x=Math.max(8,Math.min(92,score(trend.velocity))),y=Math.max(8,Math.min(92,score(trend.impact)));return `<button class="radar-point" data-trend-index="${i}" aria-label="${i+1} ${esc(trend.name)}、影響${score(trend.impact)}、速度${score(trend.velocity)}" style="left:${x}%;bottom:${y}%"><span>${i+1}</span></button>`}).join('');
  return `<section class="megatrend-layout"><article class="card radar-card"><div class="visual-heading"><div><span class="kicker">MEGATREND RADAR</span><h2>影響度 × 変化速度</h2></div><p>右上ほど「影響が大きく、進行も速い」。番号を選ぶと右の詳細と対応します。</p></div><div class="radar"><div class="radar-quadrant monitor">観測</div><div class="radar-quadrant bet">先行投資</div><div class="radar-quadrant prepare">能力構築</div><div class="radar-quadrant act">今すぐ対応</div><span class="radar-axis radar-axis-x">変化速度　低 → 高</span><span class="radar-axis radar-axis-y">影響度　低 → 高</span>${points}</div><div class="radar-index">${trends.map((trend,i)=>`<button data-trend-index="${i}"><b>${i+1}</b><span>${esc(trend.name)}</span></button>`).join('')}</div></article><article class="card trend-inventory"><span class="kicker">MEGATREND INVENTORY</span>${trends.map((trend,i)=>`<button class="trend-card" data-trend-card="${i}"><div class="trend-card-head"><b><i>${i+1}</i>${esc(trend.name)}</b><span class="tag">${esc(trend.stage||trend.horizon||'')}</span></div><p>${esc(trend.description)}</p><div class="score-row"><span>Impact</span><div class="score-bar"><span style="width:${score(trend.impact)}%"></span></div><b>${score(trend.impact)}</b></div><div class="score-row"><span>Velocity</span><div class="score-bar"><span style="width:${score(trend.velocity)}%"></span></div><b>${score(trend.velocity)}</b></div>${evidenceTags(trend.evidence_ids)}</button>`).join('')}</article></section>`;
}

function legacyWhitespaceView(result) {
  const items=arr(result.whitespaces); if(!items.length)return '<div class="empty-state"><h2>ホワイトスペースはありません</h2></div>';
  const ocean=item=>{
    const attractive=score(item.score?.market_attractiveness??item.market_attractiveness), feasible=score(item.score?.feasibility??item.feasibility), evidence=score(item.score?.evidence_strength??item.evidence_strength);
    if(attractive>=78 && feasible>=65 && evidence>=65) return {label:'BLUE-WHITE',className:'blue',meaning:'未充足の痛みが強く、実行検証に進める'};
    if(attractive>=78 && feasible<65) return {label:'WHITE / HARD',className:'white',meaning:'痛みは大きいが、能力・提携・規制で難しい'};
    if(attractive<65 && feasible>=70) return {label:'SMALL BLUE',className:'small',meaning:'小さく試せるが、市場魅力度を確認する'};
    return {label:'WATCH',className:'watch',meaning:'証拠または市場魅力度が不足'};
  };
  const points=items.map((item,i)=>{const x=score(item.score?.feasibility??item.feasibility),y=score(item.score?.market_attractiveness??item.market_attractiveness),s=score(item.score?.evidence_strength??item.evidence_strength);return `<button class="matrix-point" data-whitespace-index="${i}" aria-label="${i+1} ${esc(item.name)}、魅力度${y}、実行可能性${x}、証拠${s}" style="left:${Math.max(7,Math.min(93,x))}%;bottom:${Math.max(7,Math.min(93,y))}%;--point-size:${34+s/6}px"><span>${i+1}</span></button>`}).join('');
  const ranking=items.map((item,i)=>{const attractive=score(item.score?.market_attractiveness??item.market_attractiveness),feasible=score(item.score?.feasibility??item.feasibility),state=ocean(item);return `<button class="whitespace-rank" data-whitespace-index="${i}"><i>${String(i+1).padStart(2,'0')}</i><span><b>${esc(item.name)}</b><small>${esc(item.customer||'顧客未特定')}</small></span><em class="ocean-badge ${state.className}">${state.label}</em><strong>${Math.round((attractive+feasible)/2)}</strong></button>`}).join('');
  const details=items.map((item,i)=>{const attractive=score(item.score?.market_attractiveness??item.market_attractiveness),feasible=score(item.score?.feasibility??item.feasibility),evidence=score(item.score?.evidence_strength??item.evidence_strength),state=ocean(item);return `<article class="whitespace-detail" data-whitespace-detail="${i}" hidden><div class="whitespace-detail-head"><div><span class="kicker">WHITESPACE ${String(i+1).padStart(2,'0')}</span><h2>${esc(item.name)}</h2></div><span class="whitespace-composite">総合<br><b>${Math.round((attractive+feasible+evidence)/3)}</b></span></div><div class="ocean-callout ${state.className}"><b>${state.label}</b><span>${esc(state.meaning)}</span></div><div class="whitespace-scores"><span>市場の痛み / 魅力度 <b>${attractive}</b></span><span>実行可能性 <b>${feasible}</b></span><span>証拠強度 <b>${evidence}</b></span></div><dl class="whitespace-story"><div><dt>誰が困っているか</dt><dd>${esc(item.customer||'顧客未特定')}</dd></div><div><dt>未充足の痛み</dt><dd>${esc(item.pain)}</dd></div><div><dt>空白と見る根拠</dt><dd>${esc(item.unmet_reason)}</dd></div><div><dt>競争の読み方</dt><dd>競合社数そのものではなく、既存解決策で痛みが残る理由、買い手の予算、導入障壁、証拠強度から推定します。競合密度データが未取得なら断定しません。</dd></div><div class="opportunity-answer"><dt>何を作ればよいか</dt><dd>${esc(item.opportunity)}</dd></div><div class="next-test"><dt>最小の次の検証</dt><dd>${esc(item.next_test)}</dd></div></dl>${evidenceTags(item.evidence_ids)}</article>`}).join('');
  return `<section class="whitespace-intro"><div><span class="kicker">HOW TO READ</span><h2>空いている市場ではなく、解けていない高価な痛みを探す</h2></div><ol><li><b>White</b><span>痛みは大きいが、実行・証拠・競合確認がまだ必要</span></li><li><b>Blue</b><span>痛みが強く、既存解決の穴と実行可能性が見える</span></li><li><b>Red</b><span>需要はあるが、既存解決や競争が強く差別化が弱い</span></li></ol></section><section class="whitespace-layout"><article class="card whitespace-map-card"><div class="visual-heading"><div><span class="kicker">OPPORTUNITY SPACE</span><h2>魅力度 × 実行可能性</h2></div><p>ドットの密集は競合数ではありません。円の位置は機会の強さ、円の大きさは証拠強度、右の判定は空白の理由を示します。</p></div><div class="matrix"><span class="matrix-quadrant top-left">大きいが難しい</span><span class="matrix-quadrant top-right">優先検証</span><span class="matrix-quadrant bottom-left">保留</span><span class="matrix-quadrant bottom-right">小さく試す</span>${points}</div><div class="whitespace-ranking"><span class="kicker">RANKING / MARKET COLOR</span>${ranking}</div></article><div class="whitespace-detail-panel">${details}</div></section>`;
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

function baseConnectorsView(){
  const all=state.connectors?.connectors||[], filter=state.connectorFilter==='setup'?'setup':'available';
  const available=all.filter(item=>item.state==='ready'), setup=all.filter(item=>item.state!=='ready'), items=filter==='available'?available:setup;
  const domainNames={macro:'マクロ統計',development:'開発指標',climate:'気候',agriculture:'農業',population:'人口',industry:'産業',energy:'エネルギー',academic:'学術論文',technology:'技術',materials:'材料',chemistry:'化学',manufacturing:'製造',minerals:'鉱物',law:'法令',regulation:'規制',tax:'税務',rulings:'裁決',finance:'財務',valuation:'企業価値',weather:'気象',geospatial:'地理空間',patents:'特許',food:'食料',land:'土地',emissions:'排出量',society:'社会',environment:'環境',trade:'貿易',infrastructure:'インフラ',communities:'コミュニティ','labor law':'労働法',compliance:'コンプライアンス',policy:'政策',courts:'裁判',parliament:'議会','company filings':'企業開示',insiders:'インサイダー取引',statistics:'政府統計',companies:'企業情報',disaster:'防災','open data':'オープンデータ','real estate':'不動産',housing:'住宅',hazards:'災害リスク','consumer prices':'消費者物価',inflation:'インフレ','cost of living':'生活コスト','household consumption':'家計消費',retail:'小売・商業',commerce:'商業',migration:'移民・人口移動','foreign residents':'外国人','remittances':'海外送金','capital flows':'資本フロー','foreign investment':'外国投資','balance of payments':'国際収支',money:'資金循環','new companies':'新設法人','company status':'企業存廃',insolvency:'倒産・清算','corporate relationships':'企業関係',ownership:'所有・支配','company registry':'法人登記','legal entities':'法的主体','synthetic scenarios':'合成シナリオ','agent simulation':'エージェントシミュレーション','knowledge graph':'ナレッジグラフ','weak signals':'弱いシグナル','customer pain':'顧客課題','open-source':'OSS','developer signals':'開発者動向','source maps':'情報源マップ',signals:'変化シグナル'};
  const domains=item=>arr(item.domain).map(value=>domainNames[value]||value).join('・');
  const status=item=>item.state==='ready'
    ? {label:'今すぐ使える',detail:item.built_in_query?'追加設定なしで検索できます。':'Codexで分析するときに利用できます。'}
    : item.state==='restart_required'?{label:'登録済み / 再起動待ち',detail:'Codexを再起動するとMCPとして利用できます。'}
    : item.state==='degraded'?{label:'実装済み / 応答不安定',detail:'接続処理はありますが、直近の疎通確認はタイムアウトしました。'}
    : item.state==='key_required'?{label:'データキーの設定が必要',detail:'AIのAPIキーではなく、情報提供元のデータキーを設定すると使えます。'}
    : item.state==='not_installed'?{label:'接続作業が必要',detail:'MCPまたはアダプターをインストールし、Codexへ登録すると使えます。'}
    : item.state==='manual_import'?{label:'取込処理の追加が必要',detail:'現状は自動接続されていません。公式ファイルを取得して読み込む処理を作る必要があります。'}
    : {label:'現在利用できません',detail:'安定して利用できる接続経路を確認する必要があります。'};
  const card=item=>{const info=status(item),link=item.official||item.repository,proof=item.mcp_route?`${item.tool_count||'—'} tools · ${item.verified_at?'検証 '+item.verified_at:'未検証'}`:item.built_in_query?'内蔵REST adapter':'接続経路未完成';return `<article class="connector"><div class="connector-card-top"><span class="connector-state ${item.state==='ready'?'ready':'setup'}">● ${esc(info.label)}</span><span class="connector-proof">${esc(proof)}</span></div><h3>${esc(item.name)}</h3><p class="connector-provider">${esc(item.provider)}</p><dl><div><dt>取得できるデータ</dt><dd>${esc(domains(item)||'詳細確認が必要')}</dd></div><div><dt>${item.state==='ready'?'利用方法':'必要な準備'}</dt><dd>${esc(info.detail)}</dd></div></dl>${item.role?`<p class="connector-note">${esc(item.role)}</p>`:''}${link?`<a href="${safeUrl(link)}" target="_blank" rel="noreferrer">提供元を確認 ↗</a>`:''}</article>`};
  return `<section class="connector-overview"><div><span class="kicker">DATA AVAILABILITY</span><h2>使えるか、準備が必要かだけを見る</h2><p>地域はデータの属性であり、接続状態ではありません。ここでは利用可否だけを分け、各データが何を取得できるかを説明します。</p></div><div class="connector-counts"><button class="availability-count ${filter==='available'?'active':''}" data-filter="available"><b>${available.length}</b><span>今すぐ使える</span></button><button class="availability-count ${filter==='setup'?'active':''}" data-filter="setup"><b>${setup.length}</b><span>接続・設定が必要</span></button></div></section><div class="connector-toolbar"><button class="filter-button ${filter==='available'?'active':''}" data-filter="available">今すぐ使える</button><button class="filter-button ${filter==='setup'?'active':''}" data-filter="setup">接続・設定が必要</button></div><div class="connector-grid">${items.map(card).join('')}</div>`;
}
function methodsView(){
  const methods=state.catalog?.methods||[], log=arr(state.current?.result?.methodology);
  const legacyAliases={horizon_scanning:['horizon'],steep:['steep','pestle'],causal_mapping:['causal','systems mapping'],reference_class:['reference class','base rate'],bayesian_update:['bayes'],superforecasting:['superforecast','forecast','brier'],scenario_planning:['scenario'],cross_impact:['cross-impact','cross impact'],s_curve_trl:['s-curve','trl'],learning_curve:['learning curve'],supply_demand:['supply-demand','supply demand'],bottleneck:['bottleneck'],profit_pool:['profit pool'],whitespace:['whitespace','jtbd'],real_options:['real option'],falsifiers:['falsif','red team']};
  const uses=item=>log.filter(entry=>{const entryId=entry.method_id||entry.id;if(arr(item.run_method_ids).includes(entryId))return true;if(entry.method_id)return false;const haystack=[entry.id,entry.name,entry.note,entry.summary].filter(Boolean).join(' ').toLowerCase();return arr(legacyAliases[item.id]).some(alias=>haystack.includes(alias));});
  const usedCount=methods.filter(item=>uses(item).length).length;
  const application=entries=>entries.length?entries.map(entry=>`<div class="method-run-record"><strong>${esc(entry.summary||entry.application||entry.note||'使用記録あり')}</strong>${arr(entry.steps_applied).length?`<ol>${arr(entry.steps_applied).map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:''}${arr(entry.outputs_touched).length?`<p><b>反映先：</b>${textList(entry.outputs_touched)}</p>`:''}${entry.departures?`<p><b>原典からの変更：</b>${esc(entry.departures)}</p>`:''}${!entry.method_id?'<p class="legacy-method-note">旧形式のrunログです。適用内容は記録済みですが、手順単位の追跡は次回runから有効です。</p>':''}${evidenceTags(entry.evidence_ids)}</div>`).join(''):'<p class="method-not-used">このrunの方法論ログには使用記録がありません。方法一覧にあることと、実際に使ったことは分けて表示しています。</p>';
  const cards=methods.map((item,i)=>{const entries=uses(item),used=entries.length>0;return `<details class="method" ${used?'open':''}><summary><span class="method-number">${String(i+1).padStart(2,'0')}</span><span><b>${esc(item.name)}</b><small>${esc(item.purpose)}</small></span><i class="method-use ${used?'used':''}">${used?'このrunで使用':'未使用／記録なし'}</i></summary><div class="method-body"><section><h4>原典から踏襲した範囲</h4><p>${esc(item.borrowed)}</p></section><section><h4>Opportunity Intelligenceでの実行手順</h4><ol>${arr(item.procedure).map(step=>`<li>${esc(step)}</li>`).join('')}</ol></section><section class="method-run-application"><h4>このrunへの適用</h4>${application(entries)}</section><section><h4>必須出力</h4><div class="tag-list">${arr(item.outputs).map(output=>`<span class="tag">${esc(output)}</span>`).join('')}</div></section><section><h4>限界・誤用防止</h4><p>${esc(item.limits)}</p></section><section><h4>原典・標準・実務ガイド</h4><div class="method-references">${arr(item.references).map(ref=>`<a href="${safeUrl(ref.url)}" target="_blank" rel="noreferrer"><b>${esc(ref.title)}</b><span>${esc(ref.author)} · ${esc(ref.year)}</span></a>`).join('')}</div></section></div></details>`}).join('');
  return `<section class="method-overview"><div><span class="kicker">METHOD PROVENANCE</span><h2>名前ではなく、原典から分析結果まで追跡する</h2><p>文献をそのまま転載しているのではありません。各手法の核をどこまで踏襲し、Opportunity Intelligence用にどう操作化し、今回のrunで実際に使ったかを分離して示します。</p></div><div class="method-coverage"><b>${state.current?.result?`${usedCount} / ${methods.length}`:'—'}</b><span>${state.current?.result?'このrunで使用記録あり':'runを開くと適用状況を表示'}</span></div></section><div class="method-grid detailed">${cards}</div>`;
}

function connectorsView() {
  const all=state.connectors?.connectors||[];
  const groups=[
    ['生活・消費・物価',['consumer prices','inflation','cost of living','household consumption','retail','commerce']],
    ['不動産・土地・人口',['real estate','land','housing','population','geospatial']],
    ['外国人・越境する金',['migration','foreign residents','remittances','capital flows','foreign investment','balance of payments','money']],
    ['企業の誕生・倒産・承継',['new companies','company status','insolvency','corporate relationships','ownership','company registry','legal entities']],
    ['産業・農業・材料',['industry','manufacturing','agriculture','food','materials','minerals']],
    ['論文・技術・特許',['academic','technology','patents','open-source']]
  ];
  const matched=domains=>all.filter(item=>arr(item.domain).some(domain=>domains.includes(domain)));
  const cards=groups.map(([label,domains])=>{const items=matched(domains),ready=items.filter(item=>item.state==='ready');return `<article><b>${label}</b><p><strong>${ready.length}</strong> 利用可 / ${items.length-ready.length} 要設定</p><div>${ready.slice(0,4).map(item=>`<span>${esc(item.name)}</span>`).join('')||'<span>実動接続なし</span>'}</div></article>`;}).join('');
  const strip=`<section class="research-source-layer coverage-layer"><header><div><span class="kicker">DECISION DATA COVERAGE</span><h2>何を判断できるデータが、いま実際に使えるか</h2></div><span>${all.filter(item=>item.state==='ready').length} LIVE ROUTES</span></header><div>${cards}</div><footer>「登録」「tools/list成功」「このrunで実取得」は別状態です。カードのtool数は接続確認、run画面のconnector_idはその判断での実使用を示します。民間倒産・登記・実質支配データなど契約が必要な領域は要設定のまま表示します。</footer></section>`;
  return strip+baseConnectorsView();
}

function executiveView(result) {
  const ex=result.executive||{}, evidence=arr(result.evidence), confidence=pct(ex.confidence);
  const primary=evidence.filter(item=>item.source_tier==='primary').length;
  const counter=[...arr(ex.watchouts),...arr(result.counterarguments).map(item=>item.claim||item)].slice(0,4);
  const posture=confidence>=75?'実行・拡大':confidence>=55?'条件付き実行':confidence>=35?'小規模検証':'保留';
  const spine=arr(ex.decision_spine).slice(0,6);
  return `<section class="decision-contract">
    <header class="decision-contract-head"><div><span class="kicker">DECISION CONTRACT</span><h2>調査結論</h2></div><div class="decision-status"><span>推奨判断</span><b>${posture}</b></div></header>
    <div class="decision-conclusion"><span>結論</span><h3>${esc(ex.one_line||'結論は記録されていません')}</h3><p>${esc(ex.decision||'')}</p></div>
    <div class="decision-metrics">
      <div><span>判断信頼度</span><b>${confidence}%</b><small>発生確率ではなく、証拠と因果ロジックの確からしさ</small></div>
      <div><span>証拠台帳</span><b>${evidence.length}</b><small>一次情報 ${primary}件</small></div>
      <div><span>構造変化</span><b>${arr(result.megatrends).length}</b><small>意思決定に影響するメガトレンド</small></div>
      <div><span>機会候補</span><b>${arr(result.whitespaces).length}</b><small>競争証明前の候補を含む</small></div>
    </div>
  </section>
  <section class="decision-grid">
    <article class="decision-spine"><header><span class="kicker">DECISION SPINE</span><h3>結論までの検証可能な論理</h3></header>
      ${spine.map((item,index)=>`<div class="decision-step"><i>${String(index+1).padStart(2,'0')}</i><div><b>${esc(item.step||'判断ステップ')}</b><p>${esc(item.claim||item.step||'')}</p>${evidenceTags(item.evidence_ids)}</div></div>`).join('')||'<p>判断ロジックの記録がありません。</p>'}
    </article>
    <aside class="decision-rail">
      <section><span class="kicker">WHY NOW</span><h3>今、動く理由</h3><ol>${arr(ex.why_now).slice(0,4).map(item=>`<li>${esc(item)}</li>`).join('')||'<li>記録なし</li>'}</ol></section>
      <section class="decision-risks"><span class="kicker">DISCONFIRMATION</span><h3>反証・停止条件</h3><ol>${counter.map(item=>`<li>${esc(item)}</li>`).join('')||'<li>記録なし</li>'}</ol></section>
    </aside>
  </section>${runDataLineageView()}`;
}

function megatrendsView(result) {
  const trends=arr(result.megatrends); if(!trends.length)return '<div class="empty-state"><h2>メガトレンドはありません</h2></div>';
  const points=trends.map((trend,i)=>{const x=Math.max(8,Math.min(92,score(trend.velocity))),y=Math.max(8,Math.min(92,score(trend.impact)));return `<button class="radar-point" data-trend-index="${i}" aria-label="${i+1} ${esc(trend.name)}、影響${score(trend.impact)}、速度${score(trend.velocity)}" style="left:${x}%;bottom:${y}%"><span>${i+1}</span></button>`}).join('');
  const details=trends.map((trend,i)=>`<section class="trend-detail" data-trend-detail="${i}" ${i?'hidden':''}><header><span class="trend-number">${String(i+1).padStart(2,'0')}</span><div><span class="kicker">SELECTED TREND</span><h3>${esc(trend.name)}</h3></div></header><p class="trend-thesis">${esc(trend.description)}</p><dl><div><dt>時間軸 / 段階</dt><dd>${esc(trend.horizon||trend.stage||'未記録')}</dd></div><div><dt>構造ドライバー</dt><dd>${textList(trend.drivers)}</dd></div><div><dt>意思決定への含意</dt><dd>${textList(trend.implications)}</dd></div></dl>${evidenceTags(trend.evidence_ids)}</section>`).join('');
  return `<section class="trend-method"><div><span class="kicker">MEGATREND QUALIFICATION</span><h2>「話題」ではなく、複数年の構造変化だけを置く</h2></div><ol><li><b>01</b><span>複数年で継続</span></li><li><b>02</b><span>3つ以上のドライバー</span></li><li><b>03</b><span>価値連鎖を横断</span></li><li><b>04</b><span>証拠参照を保持</span></li></ol></section>
    <section class="trend-workbench">
      <article class="radar-card"><div class="visual-heading"><div><span class="kicker">DECISION-SPECIFIC RADAR</span><h2>この判断への影響 × 観測された変化速度</h2></div><p>軸はこのrunの問いと時間軸に限定されます。普遍的な市場分類ではありません。</p></div>
      <div class="radar"><div class="radar-quadrant monitor">観測継続</div><div class="radar-quadrant bet">高速 / 影響限定</div><div class="radar-quadrant prepare">能力を準備</div><div class="radar-quadrant act">意思決定の中核</div><span class="radar-axis radar-axis-x">観測された変化速度　低 → 高</span><span class="radar-axis radar-axis-y">今回の判断への影響　低 → 高</span>${points}</div>
      <div class="radar-index">${trends.map((trend,i)=>`<button data-trend-index="${i}"><b>${i+1}</b><span>${esc(trend.name)}</span></button>`).join('')}</div></article>
      <aside class="trend-inspector">${details}</aside>
    </section>`;
}

function competitionProof(item) {
  const competition=item.competition||{}, alternatives=arr(competition.current_alternatives), density=competition.density||'unknown';
  const evidenceIds=arr(competition.evidence_ids), gap=competition.gap||competition.documented_gap;
  const wtpValue=competition.willingness_to_pay??item.potential?.willingness_to_pay;
  const wtpText=String(wtpValue??'').trim();
  const wtpVerified=competition.wtp_verified===true||item.potential?.wtp_verified===true||(Number.isFinite(Number(wtpValue))&&Number(wtpValue)>0)||(/(確認済|検証済|契約実績|支払実績|予算確認)/.test(wtpText)&&!/(未確認|未検証|仮定|可能性|要検証|証拠なし|必要)/.test(wtpText));
  const proven=alternatives.length>0 && evidenceIds.length>0 && ['low','medium','high'].includes(density) && Boolean(gap);
  if(!proven)return {label:'PROOF QUEUE',kind:'queue',className:'unverified',meaning:'観測した代替手段、競争密度、未充足ギャップ、競争証拠のいずれかが不足',proven:false,wtpVerified,gapVerified:Boolean(gap)};
  if(density==='high')return {label:'RED / 混雑',kind:'red',className:'red',meaning:'観測された代替手段が多く競争密度も高い。差別化と獲得コストの証明が必要',proven:true,wtpVerified,gapVerified:true};
  if(density==='low'&&gap&&wtpVerified)return {label:'WHITE / 検証済',kind:'white',className:'blue',meaning:'低い解決飽和、高い未充足需要、支払意思を確認',proven:true,wtpVerified,gapVerified:true};
  return {label:'MARKET MAPPED',kind:'mapped',className:'white',meaning:'競合と代替は観測済み。ホワイトスペース確定には支払意思を追加検証',proven:true,wtpVerified,gapVerified:true};
}

function stableHash(value) {
  return [...String(value)].reduce((hash,char)=>((hash*31)+char.charCodeAt(0))>>>0,2166136261);
}

function whitespaceView(result) {
  const items=arr(result.whitespaces); if(!items.length)return '<div class="empty-state"><h2>機会候補はありません</h2></div>';
  const points=items.map((item,i)=>{const x=score(item.score?.feasibility??item.feasibility),y=score(item.score?.market_attractiveness??item.market_attractiveness),s=score(item.score?.evidence_strength??item.evidence_strength),proof=competitionProof(item);return `<button class="matrix-point ${proof.className}" data-whitespace-index="${i}" aria-label="${i+1} ${esc(item.name)}" style="left:${Math.max(7,Math.min(93,x))}%;bottom:${Math.max(7,Math.min(93,y))}%;--point-size:${34+s/6}px"><span>${i+1}</span></button>`}).join('');
  const ranking=items.map((item,i)=>{const proof=competitionProof(item),a=score(item.score?.market_attractiveness??item.market_attractiveness),f=score(item.score?.feasibility??item.feasibility);return `<button class="whitespace-rank" data-whitespace-index="${i}"><i>${String(i+1).padStart(2,'0')}</i><span><b>${esc(item.name)}</b><small>${esc(item.customer||'顧客未特定')}</small></span><em class="ocean-badge ${proof.className}">${proof.label}</em><strong>${Math.round((a+f)/2)}</strong></button>`}).join('');
  const details=items.map((item,i)=>{const proof=competitionProof(item),competition=item.competition||{},alternatives=arr(competition.current_alternatives),a=score(item.score?.market_attractiveness??item.market_attractiveness),f=score(item.score?.feasibility??item.feasibility),e=score(item.score?.evidence_strength??item.evidence_strength);const gates=[['顧客課題',Boolean(item.pain)],['買い手',Boolean(item.buyer||item.customer)],['現行の代替手段',alternatives.length>0],['競争密度',competition.density&&competition.density!=='unknown'],['支払意思 / 予算',Boolean(competition.willingness_to_pay||item.budget)]];return `<article class="whitespace-detail" data-whitespace-detail="${i}" ${i?'hidden':''}><header class="whitespace-detail-head"><div><span class="kicker">OPPORTUNITY CANDIDATE ${String(i+1).padStart(2,'0')}</span><h2>${esc(item.name)}</h2></div><span class="whitespace-composite">候補スコア<br><b>${Math.round((a+f+e)/3)}</b></span></header><div class="ocean-callout ${proof.className}"><b>${proof.label}</b><span>${esc(proof.meaning)}</span></div><div class="proof-gates">${gates.map(([label,ok])=>`<span class="${ok?'pass':'missing'}"><b>${ok?'✓':'–'}</b>${label}</span>`).join('')}</div><dl class="whitespace-story"><div><dt>顧客 / 買い手</dt><dd>${esc(item.customer||item.buyer||'未特定')}</dd></div><div><dt>未充足の痛み</dt><dd>${esc(item.pain||'未記録')}</dd></div><div><dt>現行の代替手段</dt><dd>${alternatives.length?textList(alternatives):'未調査。この状態ではブルーオーシャンと断定しない。'}</dd></div><div><dt>競争密度</dt><dd>${esc(competition.density||'未検証')}</dd></div><div><dt>仮説</dt><dd>${esc(item.opportunity||item.unmet_reason||'未記録')}</dd></div><div class="next-test"><dt>次の検証</dt><dd>${esc(item.next_test||'競合・代替手段・支払意思を一次情報で確認する')}</dd></div></dl>${evidenceTags(item.evidence_ids)}</article>`}).join('');
  return `<section class="whitespace-method"><div><span class="kicker">WHITESPACE PROOF STANDARD</span><h2>魅力度が高いだけでは、ホワイトスペースではない</h2><p>ドットは機会候補です。競合・代替手段・競争密度の証拠がそろうまで「競争未検証」と表示します。</p></div><div class="whitespace-legend"><span><i class="unverified"></i>未検証</span><span><i class="blue"></i>未充足確認</span><span><i class="white"></i>要実験</span><span><i class="red"></i>混雑</span></div></section><section class="whitespace-layout"><article class="whitespace-map-card"><div class="visual-heading"><div><span class="kicker">OPPORTUNITY CANDIDATE MAP</span><h2>魅力度 × 実行可能性</h2></div><p>円の大きさは証拠強度。色は競争証明の状態です。</p></div><div class="matrix"><span class="matrix-quadrant top-left">魅力大 / 実行難</span><span class="matrix-quadrant top-right">優先検証</span><span class="matrix-quadrant bottom-left">保留</span><span class="matrix-quadrant bottom-right">小さく試す</span>${points}</div><div class="whitespace-ranking">${ranking}</div></article><aside class="whitespace-detail-panel">${details}</aside></section>`;
}

function finiteScore(value) {
  const number=Number(value);
  if(!Number.isFinite(number)) return null;
  return number<=1?Math.round(number*100):Math.max(0,Math.min(100,Math.round(number)));
}

function transformationDecisionView(result) {
  const graph=result.knowledge_graph||{nodes:[],edges:[]}, allNodes=arr(graph.nodes).slice(0,36);
  const allEdges=arr(graph.edges).filter(edge=>allNodes.some(node=>node.id===edge.source)&&allNodes.some(node=>node.id===edge.target));
  if(!allNodes.length) return '<div class="empty-state"><h2>変革マップはありません</h2><p>因果ノードと関係が生成されると、ここで探索できます。</p></div>';
  const W=1180,H=720,cx=W/2,cy=H/2, colors={trend:'#cddd4a',driver:'#22a0a7',risk:'#dd5548',sector:'#d89a36',company:'#a998d7',policy:'#67b879',technology:'#6da3d5',evidence:'#939b97'};
  const degree=new Map(allNodes.map(node=>[node.id,allEdges.filter(edge=>edge.source===node.id||edge.target===node.id).length]));
  const topic=String(state.current?.request?.query||result.metadata?.title||'判断テーマ');
  const topicNodes=allNodes.filter(node=>node.type==='sector'||String(node.label).includes('価格'));
  const centerNode=[...(topicNodes.length?topicNodes:allNodes)].sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0))[0];
  const innerTypes=new Set(['trend','driver','technology','policy']);
  const inner=allNodes.filter(node=>node.id!==centerNode.id&&innerTypes.has(node.type));
  const outer=allNodes.filter(node=>node.id!==centerNode.id&&!innerTypes.has(node.type));
  const positions=new Map([[centerNode.id,{x:cx,y:cy,layer:'center'}]]);
  const place=(items,radius,layer,offset)=>items.forEach((node,index)=>{const angle=(index/Math.max(1,items.length))*Math.PI*2-Math.PI/2+offset;positions.set(node.id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius,layer});});
  place(inner,205,'forces',.04); place(outer,326,'outcomes',.22);
  const edges=allEdges.filter(edge=>positions.has(edge.source)&&positions.has(edge.target));
  const edgeSvg=edges.map((edge,index)=>{const source=positions.get(edge.source),target=positions.get(edge.target),negative=edge.polarity==='negative';return `<line data-graph-edge="${index}" data-source="${esc(edge.source)}" data-target="${esc(edge.target)}" class="graph-edge ${negative?'negative':''}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke-width="${Math.max(1.2,Number(edge.weight||.5)*3.6)}" marker-end="url(#${negative?'arrow-negative':'arrow-positive'})"><title>${esc(edge.type)} / ${esc(edge.polarity||'positive')}</title></line>`;}).join('');
  const ordered=[centerNode,...inner,...outer];
  const nodeSvg=ordered.map(node=>{const position=positions.get(node.id),isCenter=node.id===centerNode.id,r=isCenter?29:10+score(node.confidence)/20;return `<g role="button" tabindex="0" aria-label="${esc(node.label)}、${esc(node.type)}、信頼度${score(node.confidence)}" data-graph-node="${esc(node.id)}" data-label="${esc(node.label)}" data-type="${esc(node.type)}" data-layer="${position.layer}" data-x="${position.x}" data-y="${position.y}" data-initial-x="${position.x}" data-initial-y="${position.y}" class="graph-node ${isCenter?'center-node':''}" transform="translate(${position.x} ${position.y})"><circle r="${r}" fill="${colors[node.type]||'#e7e5dc'}"></circle><text x="${isCenter?0:r+7}" y="${isCenter?48:4}" text-anchor="${isCenter?'middle':'start'}">${esc(node.label)}</text></g>`;}).join('');
  const details=ordered.map(node=>{const connected=edges.filter(edge=>edge.source===node.id||edge.target===node.id),evidenceCount=arr(node.evidence_ids).length;return `<section class="graph-detail" data-graph-detail="${esc(node.id)}" hidden><div class="graph-detail-meta"><span class="node-type" style="--node-color:${colors[node.type]||'#e7e5dc'}">${esc(node.type)}</span><span>${esc(positions.get(node.id).layer)}</span></div><h3>${esc(node.label)}</h3><p class="graph-why"><b>この判断での意味</b>${connected.length?`${connected.length}本の因果関係を通じ、${esc(topic)}の判断へ影響します。`:'現時点では独立した観測ノードです。'}</p><div class="graph-confidence"><span>信頼度</span><b>${score(node.confidence)}</b><div><i style="width:${score(node.confidence)}%"></i></div></div><div class="graph-proof-count"><b>${evidenceCount}</b><span>evidence links</span></div>${connected.slice(0,7).map(edge=>{const outgoing=edge.source===node.id,other=ordered.find(item=>item.id===(outgoing?edge.target:edge.source));return `<p class="graph-relation"><i>${outgoing?'→':'←'}</i><span><b>${esc(edge.type)}</b>${esc(other?.label||'')}</span></p>`;}).join('')||'<p>接続関係はありません。</p>'}${evidenceTags(node.evidence_ids)}</section>`;}).join('');
  const types=[...new Set(ordered.map(node=>node.type).filter(Boolean))];
  const hubRows=[...ordered].sort((a,b)=>(degree.get(b.id)||0)-(degree.get(a.id)||0)).slice(0,5).map(node=>`<span><b>${esc(node.label)}</b><i>${degree.get(node.id)||0} links</i></span>`).join('');
  return `${runDataLineageView()}<section class="map-contract"><div><span class="kicker">TRANSFORMATION MAP CONTRACT</span><h2>中心テーマから、構造要因と外部影響を分けて読む</h2><p>中心は今回の判断、内周は変化を起こす力、外周は影響を受ける市場・企業・リスクです。線は因果仮説で、密集度をホワイトスペースとは扱いません。</p></div><ol><li><b>01</b><span>中心<br><i>Decision topic</i></span></li><li><b>02</b><span>内周<br><i>Key forces</i></span></li><li><b>03</b><span>外周<br><i>Outcomes & actors</i></span></li></ol></section><section class="graph-explorer transformation-map"><div class="graph-toolbar"><div><span class="kicker">WEF-STYLE SYSTEM VIEW</span><h2>${esc(topic)}の変革マップ</h2><p>ノードを選択すると、関係・信頼度・証拠を右側で確認できます。</p></div><div class="graph-actions"><button data-graph-action="zoom-out" aria-label="縮小">−</button><button data-graph-action="zoom-in" aria-label="拡大">＋</button><button data-graph-action="fit">全体表示</button><button data-graph-action="reset">配置を戻す</button></div></div><div class="graph-filters"><button class="active" data-graph-filter="all">すべて ${ordered.length}</button>${types.map(type=>`<button data-graph-filter="${esc(type)}"><i style="--node-color:${colors[type]||'#e7e5dc'}"></i>${esc(type)} ${ordered.filter(node=>node.type===type).length}</button>`).join('')}</div><div class="graph-stage"><div class="graph-wrap"><svg id="knowledge-graph" viewBox="0 0 ${W} ${H}" role="application" aria-label="動的な変革マップ"><g data-graph-world><defs><marker id="arrow-positive" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"></path></marker><marker id="arrow-negative" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"></path></marker></defs><circle class="system-ring ring-outer" cx="${cx}" cy="${cy}" r="326"></circle><circle class="system-ring ring-inner" cx="${cx}" cy="${cy}" r="205"></circle><text class="system-ring-label" x="${cx}" y="${cy-334}" text-anchor="middle">OUTCOMES / ACTORS / RISKS</text><text class="system-ring-label" x="${cx}" y="${cy-214}" text-anchor="middle">STRUCTURAL FORCES</text>${edgeSvg}${nodeSvg}</g></svg><div class="graph-legend">緑系＝促進　赤＝抑制　線幅＝影響強度　点の大きさ＝信頼度</div></div><aside class="graph-inspector"><span class="kicker">SELECTED NODE</span><p id="graph-selection-label" class="graph-selection-label">ノードを選択</p>${details}</aside></div></section><section class="map-readout"><article><span class="kicker">SYSTEM HOTSPOTS</span><h3>接続が集中する争点</h3><div>${hubRows}</div></article><article><span class="kicker">INTERPRETATION LIMIT</span><h3>この図だけでは言えないこと</h3><p>接続数は因果上の重要度であり、競合数、需要規模、利益額、ホワイトスペースを示しません。各判定は専用ビューの証明基準で行います。</p></article></section>`;
}

function trendCategory(trend) {
  const text=[trend.name,...arr(trend.drivers)].join(' ');
  if(/電力|材料|環境|資源|水/.test(text)) return 'ENVIRONMENT';
  if(/規制|政策|補助|地域分散|輸出/.test(text)) return 'POLICY';
  if(/AI|パッケージ|技術|HBM|チップ|ノード/.test(text)) return 'TECHNOLOGY';
  if(/雇用|人口|消費者|社会/.test(text)) return 'SOCIETY';
  return 'ECONOMY';
}

function trendHorizonPosition(trend) {
  const values=String(trend.horizon||'').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
  const midpoint=values.length>1?(values[0]+values[1])/2:(values[0]||5);
  return midpoint<=3?{band:'0–3年',radius:.34}:midpoint<=6?{band:'3–6年',radius:.61}:{band:'6–10年',radius:.84};
}

function marketEntitiesFor(result,item,kind) {
  const priority={listed:0,listed_parent:1,private:2,public:3,unknown:4};
  return arr(result.market_landscape?.entities)
    .map(entity=>({entity,links:arr(entity.links).filter(link=>link.kind===kind&&link.id===item.id)}))
    .filter(record=>record.links.length)
    .sort((a,b)=>(priority[a.entity.listing?.status]??5)-(priority[b.entity.listing?.status]??5)||String(a.entity.name).localeCompare(String(b.entity.name),'ja'));
}

function marketLandscapePanel(result,item,kind) {
  const records=marketEntitiesFor(result,item,kind),evidence=new Map(arr(result.evidence).map(entry=>[entry.id,entry]));
  if(!records.length)return `<section class="related-market empty"><header><div><span class="kicker">RELATED MARKET</span><h3>企業・既存サービス</h3></div><span>未構造化</span></header><p>この項目に紐づく企業・サービスは、まだ上場確認と関係証拠を構造化できていません。</p></section>`;
  const listed=records.filter(record=>['listed','listed_parent'].includes(record.entity.listing?.status)).length;
  const cards=records.map(({entity,links})=>{const listing=entity.listing||{},status=listing.status||'unknown',listedStatus=status==='listed'||status==='listed_parent',listingLine=listedStatus?`${esc(listing.exchange||'市場未記録')} · ${esc(listing.ticker||'ticker未記録')}${status==='listed_parent'?` · 親会社 ${esc(listing.parent||'')}`:''}`:status==='private'?'PRIVATE / 非上場':status==='public'?'PUBLIC / 公的主体':'LISTING UNVERIFIED',proofs=arr(entity.evidence_ids).map(id=>{const source=evidence.get(id);return source?`<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer" title="${esc(source.title)}">↗ ${esc(id)}</a>`:`<span>↗ ${esc(id)}</span>`;}).join('');return `<article class="market-entity"><div class="market-entity-head"><span class="entity-type">${esc(entity.entity_type||'company')}</span><span class="listing-badge ${esc(status)}">${status==='listed'?'LISTED':status==='listed_parent'?'LISTED PARENT':status==='private'?'PRIVATE':status==='public'?'PUBLIC':'UNVERIFIED'}</span></div><h4>${esc(entity.name)}</h4><p class="listing-line">${listingLine} · ${esc(entity.country||'地域未記録')} · ${esc(entity.scale||'規模未記録')}</p><p class="entity-role">${esc(entity.role)}</p><div class="entity-relation"><b>この項目との関係</b>${links.map(link=>`<span>${esc(link.relationship)}</span>`).join('')}</div>${arr(entity.offerings).length?`<div class="offering-tags">${arr(entity.offerings).map(offering=>`<span>${esc(offering)}</span>`).join('')}</div>`:''}<div class="entity-proof">${proofs}</div></article>`;}).join('');
  return `<details class="related-market" open><summary><span><small>RELATED COMPANIES &amp; SERVICES</small><b>現実のプレイヤーと既存解決策</b></span><span><strong>${listed}</strong> listed / <strong>${records.length}</strong> total</span></summary><p class="market-scope-note">上場企業を先に表示。関連性は事業・サービス証拠で確認し、投資妙味・割安性とは分けています。</p><div class="related-market-list">${cards}</div></details>`;
}

function marketLandscapePreview(result,item,kind) {
  const records=marketEntitiesFor(result,item,kind); if(!records.length)return '';
  const chips=records.slice(0,5).map(({entity})=>`<span><b>${esc(entity.listing?.ticker||entity.entity_type||'ENTITY')}</b>${esc(entity.name)}</span>`).join('');
  return `<section class="market-preview"><header><b>関連企業・既存サービス</b><span>${records.length} entities · 上場優先</span></header><div>${chips}${records.length>5?`<span class="more"><b>+${records.length-5}</b>下の詳細で全件表示</span>`:''}</div></section>`;
}

function megatrendsDecisionView(result) {
  const trends=arr(result.megatrends); if(!trends.length)return '<div class="empty-state"><h2>メガトレンドはありません</h2></div>';
  const axes=['TECHNOLOGY','ECONOMY','POLICY','ENVIRONMENT','SOCIETY'],angles=new Map(axes.map((axis,index)=>[axis,-Math.PI/2+(index/axes.length)*Math.PI*2]));
  const cx=310,cy=310,maxR=236;
  const foresightPoints=trends.map((trend,index)=>{const category=trendCategory(trend),horizon=trendHorizonPosition(trend),angle=angles.get(category)+(index*.055),radius=maxR*horizon.radius,x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;return `<g role="button" tabindex="0" class="foresight-point" data-trend-index="${index}" aria-label="${index+1} ${esc(trend.name)}、${category}、${horizon.band}" transform="translate(${x} ${y})"><circle r="17"></circle><text y="5" text-anchor="middle">${index+1}</text></g>`;}).join('');
  const matrixPoints=trends.map((trend,index)=>`<button class="priority-point" data-trend-index="${index}" aria-label="${index+1} ${esc(trend.name)}" style="left:${Math.max(7,Math.min(93,score(trend.velocity)))}%;bottom:${Math.max(7,Math.min(93,score(trend.impact)))}%"><span>${index+1}</span></button>`).join('');
  const details=trends.map((trend,index)=>{const category=trendCategory(trend),horizon=trendHorizonPosition(trend),driverCount=arr(trend.drivers).length,evidenceCount=arr(trend.evidence_ids).length,qualifies=driverCount>=3&&arr(trend.implications).length>=2&&evidenceCount>=2;return `<section class="trend-detail" data-trend-detail="${index}" ${index?'hidden':''}><header><span class="trend-number">${String(index+1).padStart(2,'0')}</span><div><span class="kicker">SELECTED STRUCTURAL CHANGE</span><h3>${esc(trend.name)}</h3></div></header><div class="trend-verdict ${qualifies?'pass':'review'}"><b>${qualifies?'MEGATREND QUALIFIED':'REVIEW REQUIRED'}</b><span>${qualifies?'複数年・複数ドライバー・価値連鎖横断・証拠参照を満たす':'証明ゲートの一部が不足'}</span></div><p class="trend-thesis">${esc(trend.description)}</p><dl><div><dt>なぜメガトレンドか</dt><dd>${driverCount}ドライバー、${arr(trend.implications).length}つの意思決定含意、${evidenceCount}件の証拠を持つ構造変化</dd></div><div><dt>分類 / 時間帯</dt><dd>${category} · ${horizon.band} · ${esc(trend.stage||'段階未記録')}</dd></div><div><dt>構造ドライバー</dt><dd>${textList(trend.drivers)}</dd></div><div><dt>意思決定への含意</dt><dd>${textList(trend.implications)}</dd></div></dl>${marketLandscapePanel(result,trend,'megatrend')}${evidenceTags(trend.evidence_ids)}</section>`;}).join('');
  const qualificationRows=trends.map((trend,index)=>`<button data-trend-card="${index}" class="trend-proof-row"><i>${String(index+1).padStart(2,'0')}</i><b>${esc(trend.name)}</b><span>${trendCategory(trend)}</span><span>${trendHorizonPosition(trend).band}</span><span>${arr(trend.drivers).length} drivers</span><span>${arr(trend.evidence_ids).length} evidence</span></button>`).join('');
  return `<section class="trend-contract"><div><span class="kicker">MEGATREND PROOF STANDARD</span><h2>時間・構造・波及・証拠の4条件で選別</h2><p>単なるニュース量ではなく、複数年に続き、独立した複数ドライバーを持ち、価値連鎖を横断し、根拠を追跡できる変化だけを表示します。</p></div><div class="trend-contract-metrics"><span><b>${trends.length}</b>qualified candidates</span><span><b>${trends.reduce((sum,item)=>sum+arr(item.evidence_ids).length,0)}</b>evidence links</span></div></section><section class="trend-visual-grid"><article class="foresight-radar-card"><div class="visual-heading"><div><span class="kicker">TREND RADAR / RESTORED</span><h2>どの領域で、いつ顕在化するか</h2></div><p>同心円は時間帯、方位はSTEEP系の変化領域です。近い円ほど早く意思決定へ到達します。</p></div><svg class="foresight-radar" viewBox="0 0 620 620" role="img" aria-label="メガトレンド時間レーダー"><circle cx="${cx}" cy="${cy}" r="80"></circle><circle cx="${cx}" cy="${cy}" r="144"></circle><circle cx="${cx}" cy="${cy}" r="198"></circle><circle cx="${cx}" cy="${cy}" r="${maxR}"></circle>${axes.map(axis=>{const angle=angles.get(axis),x=cx+Math.cos(angle)*maxR,y=cy+Math.sin(angle)*maxR,lx=cx+Math.cos(angle)*(maxR+34),ly=cy+Math.sin(angle)*(maxR+34);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line><text x="${lx}" y="${ly}" text-anchor="middle">${axis}</text>`;}).join('')}<text class="ring-label" x="${cx}" y="${cy-70}">0–3Y</text><text class="ring-label" x="${cx}" y="${cy-134}">3–6Y</text><text class="ring-label" x="${cx}" y="${cy-188}">6–10Y</text>${foresightPoints}</svg><div class="radar-index compact">${trends.map((trend,index)=>`<button data-trend-index="${index}"><b>${index+1}</b><span>${esc(trend.name)}</span></button>`).join('')}</div></article><article class="priority-matrix-card"><div class="visual-heading"><div><span class="kicker">DECISION PRIORITY MATRIX</span><h2>影響度 × 観測モメンタム</h2></div><p>これはレーダーではありません。今回の問いに対する優先順位を比較する補助図です。</p></div><div class="priority-matrix"><span class="quadrant q1">能力構築</span><span class="quadrant q2">中核判断</span><span class="quadrant q3">監視</span><span class="quadrant q4">高速だが影響限定</span><span class="axis x">観測モメンタム　低 → 高</span><span class="axis y">判断への影響　低 → 高</span>${matrixPoints}</div><aside class="trend-inspector">${details}</aside></article></section><section class="trend-proof-table"><header><span class="kicker">QUALIFICATION LEDGER</span><h3>なぜこの5件をメガトレンドと呼ぶのか</h3></header><div class="trend-proof-head"><span>#</span><span>構造変化</span><span>領域</span><span>時間帯</span><span>ドライバー</span><span>証拠</span></div>${qualificationRows}</section>`;
}

function whitespaceDecisionView(result) {
  const items=arr(result.whitespaces); if(!items.length)return '<div class="empty-state"><h2>機会候補はありません</h2></div>';
  const records=items.map((item,index)=>{const proof=competitionProof(item),competition=item.competition||{},potential=item.potential||{},unmet=finiteScore(competition.unmet_need_score??potential.unmet_need_score),saturation=finiteScore(competition.saturation_score),mapReady=proof.proven&&unmet!==null&&saturation!==null;return {item,index,proof,competition,potential,unmet,saturation,mapReady};});
  const classify=record=>{
    if(!record.mapReady)return {label:'PROOF QUEUE',kind:'queue',className:'unverified',meaning:'競合数、競争密度、未充足度の比較に必要な証拠が不足'};
    if(record.unmet>=60&&record.saturation<40&&record.proof.wtpVerified)return {label:'WHITE / VERIFIED',kind:'white',className:'blue',meaning:'未充足需要が高く、解決飽和が低く、支払意思も確認済み'};
    if(record.unmet>=60&&record.saturation<40)return {label:'WHITE CANDIDATE',kind:'candidate',className:'candidate',meaning:'市場の空きは見えるが、支払意思が未検証のため確定できない'};
    if(record.unmet>=60&&record.saturation>=40)return {label:'CONTESTED',kind:'contested',className:'white',meaning:'未充足需要は高いが解決策も多い。ここは空白ではなく差別化競争の領域'};
    if(record.unmet<60&&record.saturation>=40)return {label:'RED / OVERHEATED',kind:'red',className:'red',meaning:'相対的に弱い未充足需要に対し解決策が多い'};
    return {label:'EMPTY FOR A REASON',kind:'empty',className:'empty',meaning:'競争は少ないが、需要と支払意思も弱い可能性'};
  };
  const classified=records.map(record=>({...record,state:classify(record)})),mapped=classified.filter(record=>record.mapReady),queued=classified.filter(record=>!record.mapReady);
  const count=kind=>classified.filter(record=>record.state.kind===kind).length;
  const observedAlternatives=mapped.reduce((total,record)=>total+arr(record.competition.current_alternatives).length,0);
  const halos=mapped.map(record=>{const alternatives=arr(record.competition.current_alternatives),size=90+alternatives.length*12+record.saturation/2;return `<span class="market-crowding-halo density-${esc(record.competition.density)}" style="left:${record.saturation}%;bottom:${record.unmet}%;--halo-size:${size}px" aria-hidden="true"></span>`;}).join('');
  const alternativePoints=mapped.flatMap(record=>arr(record.competition.current_alternatives).map(alternative=>{const hash=stableHash(`${record.index}-${alternative}`),dx=((hash%1501)/100)-7.5,dy=(((hash>>>11)%1401)/100)-7,x=Math.max(3,Math.min(97,record.saturation+dx)),y=Math.max(3,Math.min(97,record.unmet+dy));return `<span class="market-alternative-point" style="left:${x}%;bottom:${y}%" title="${esc(alternative)}" aria-hidden="true"></span>`;})).join('');
  const points=mapped.map(record=>`<button class="whitespace-proof-point ${record.state.className}" data-whitespace-index="${record.index}" style="left:${record.saturation}%;bottom:${record.unmet}%" aria-label="${record.index+1} ${esc(record.item.name)}、${record.state.label}"><span>${record.index+1}</span></button>`).join('');
  const ranks=classified.map(record=>`<button class="whitespace-rank" data-whitespace-index="${record.index}"><i>${String(record.index+1).padStart(2,'0')}</i><span><b>${esc(record.item.name)}</b><small>${esc(record.item.customer||'顧客未特定')}</small></span><em class="ocean-badge ${record.state.className}">${record.state.label}</em><strong>${record.state.kind==='queue'?'QUEUE':record.state.kind==='candidate'?'WTP':'MAP'}</strong></button>`).join('');
  const baselineRows=classified.map(record=>{const alternatives=arr(record.competition.current_alternatives),wtp=record.proof.wtpVerified?'確認済':'未検証';return `<button class="market-baseline-row" data-whitespace-index="${record.index}"><i>${String(record.index+1).padStart(2,'0')}</i><span><b>${esc(record.item.name)}</b><small>${alternatives.slice(0,2).map(esc).join(' / ')||'観測なし'}</small></span><strong>${alternatives.length}</strong><em>${esc(record.competition.density||'unknown')}</em><span>${record.saturation===null?'—':`${record.saturation}/100`}</span><span class="wtp-status ${record.proof.wtpVerified?'verified':'missing'}">${wtp}</span><b class="market-state ${record.state.className}">${record.state.label}</b></button>`;}).join('');
  const potentialValue=(value,suffix='')=>value===undefined||value===null||value===''?'<b class="not-calculated">未算定</b>':`<b>${esc(value)}${suffix}</b>`;
  const details=classified.map(record=>{const item=record.item,alternatives=arr(record.competition.current_alternatives),evidenceIds=arr(record.competition.evidence_ids),gates=[['顧客・買い手',Boolean(item.customer&&(item.buyer||item.customer))],['観測代替',alternatives.length>0],['競争密度',record.competition.density&&record.competition.density!=='unknown'],['飽和度スコア',record.saturation!==null],['未充足度',record.unmet!==null],['未充足ギャップ',record.proof.gapVerified],['支払意思の実証',record.proof.wtpVerified],['競争証拠',evidenceIds.length>0]],proofState=record.state.kind==='white'?['verified','WHITE VERIFIED']:record.mapReady?['mapped','COMPETITION MAPPED']:['queued','PROOF QUEUE'];return `<article class="whitespace-detail" data-whitespace-detail="${record.index}" ${record.index?'hidden':''}><header class="whitespace-detail-head"><div><span class="kicker">OPPORTUNITY ${String(record.index+1).padStart(2,'0')}</span><h2>${esc(item.name)}</h2></div><span class="proof-state ${proofState[0]}">${proofState[1]}</span></header><div class="ocean-callout ${record.state.className}"><b>${record.state.label}</b><span>${esc(record.state.meaning)}</span></div><div class="proof-gates">${gates.map(([label,ok])=>`<span class="${ok?'pass':'missing'}"><b>${ok?'✓':'–'}</b>${label}</span>`).join('')}</div>${marketLandscapePreview(result,item,'whitespace')}<section class="competition-evidence"><h3>競争・代替の証明</h3><dl><div><dt>観測代替 (${alternatives.length})</dt><dd>${alternatives.length?textList(alternatives):'未調査。競合がいないとは言えません。'}</dd></div><div><dt>競争密度</dt><dd>${esc(record.competition.density||'unknown')}</dd></div><div><dt>解決飽和 / 未充足</dt><dd>${record.saturation===null?'—':record.saturation}/100 · ${record.unmet===null?'—':record.unmet}/100</dd></div><div><dt>未充足ギャップ</dt><dd>${esc(record.competition.gap||record.competition.documented_gap||'未証明')}</dd></div><div><dt>支払意思</dt><dd><b class="wtp-inline ${record.proof.wtpVerified?'verified':'missing'}">${record.proof.wtpVerified?'実証済':'未実証'}</b>${esc(record.competition.willingness_to_pay||record.potential.willingness_to_pay||'未記録')}</dd></div></dl>${evidenceTags(evidenceIds)}</section><section class="opportunity-potential"><h3>価値ポテンシャル（判定とは分離）</h3><div><span>市場規模 / TAM${potentialValue(record.potential.tam)}</span><span>買い手予算 / WTP${potentialValue(record.potential.willingness_to_pay||record.competition.willingness_to_pay)}</span><span>成長追い風${potentialValue(record.potential.growth)}</span><span>粗利余地${potentialValue(record.potential.gross_margin)}</span><span>反復可能性${potentialValue(record.potential.repeatability)}</span><span>防御力${potentialValue(record.potential.defensibility)}</span></div></section>${marketLandscapePanel(result,item,'whitespace')}<dl class="whitespace-story"><div><dt>顧客 / 買い手</dt><dd>${esc(item.customer||item.buyer||'未特定')}</dd></div><div><dt>高価な未充足課題</dt><dd>${esc(item.pain||item.unmet_need||'未記録')}</dd></div><div><dt>提案する解決</dt><dd>${esc(item.solution||item.opportunity||'未記録')}</dd></div><div class="next-test"><dt>次の証明</dt><dd>${esc(item.next_test||'競合、代替、支払意思を一次情報と顧客面談で確認する')}</dd></div></dl>${evidenceTags(item.evidence_ids)}</article>`;}).join('');
  const whiteCount=count('white'),contestedCount=count('contested'),redCount=count('red'),candidateCount=count('candidate');
  return `<section class="whitespace-contract"><div><span class="kicker">WHITE SPACE EVIDENCE STANDARD</span><h2>未充足需要 × 競合混雑 × 支払意思で判定</h2><p>「誰もやっていない」だけではホワイトスペースではありません。観測した競合・代替が少なく、高価な未充足課題と買い手の支払意思が揃った時だけ確定します。</p></div><div class="whitespace-counts expanded"><span><b>${whiteCount}</b>white verified</span><span><b>${candidateCount}</b>white candidates</span><span><b>${contestedCount}</b>contested</span><span><b>${redCount}</b>red / empty</span><span><b>${queued.length}</b>proof queue</span></div></section><section class="whitespace-verdict ${whiteCount?'has-white':'no-white'}"><div><span class="kicker">CURRENT RUN VERDICT</span><h2>${whiteCount?`確認済みホワイトスペース ${whiteCount}件`:'確認済みホワイトスペースは 0件'}</h2></div><p>このrunでは ${contestedCount}件が競争領域、${candidateCount}件が支払意思の実証待ち、${queued.length}件が競争証拠の不足です。空白を演出せず、現在言えるところまでを表示します。</p></section><section class="whitespace-definition"><article><b>WHITE</b><span>未充足 高 × 飽和 低 × WTP実証</span></article><article><b>CONTESTED</b><span>未充足 高 × 飽和 高</span></article><article><b>RED</b><span>未充足 低 × 飽和 高</span></article><article><b>EMPTY</b><span>未充足 低 × 飽和 低</span></article></section><section class="whitespace-layout evidence-first"><article class="whitespace-map-card"><div class="visual-heading"><div><span class="kicker">MARKET CROWDING MAP</span><h2>未充足需要 × 解決策飽和度</h2></div><p>${observedAlternatives}件の現行代替と${mapped.length}件の機会候補を同時表示。灰色の小点が観測した競合・代替です。</p></div><div class="market-map-legend"><span><i class="alternative"></i>観測した競合・代替</span><span><i class="opportunity"></i>機会候補</span><span><i class="halo"></i>観測混雑ハロー</span></div><div class="whitespace-proof-map"><span class="market-zone zone-white" aria-hidden="true"></span><span class="market-zone zone-contested" aria-hidden="true"></span><span class="market-zone zone-empty" aria-hidden="true"></span><span class="market-zone zone-red" aria-hidden="true"></span><span class="quadrant white-space">WHITE<br><i>高未充足・低飽和・WTP確認</i></span><span class="quadrant contested">CONTESTED<br><i>高未充足・高飽和</i></span><span class="quadrant empty">EMPTY FOR A REASON</span><span class="quadrant red-space">RED / OVERHEATED</span><span class="axis x">解決策の飽和度　低 → 高</span><span class="axis y">未充足需要　低 → 高</span>${halos}${alternativePoints}${points}${!mapped.length?'<div class="map-empty-proof"><b>現在、市場マップ掲載0件</b><span>競争・代替・飽和度・未充足度の証拠が不足しています。</span></div>':''}</div><p class="market-map-note">小点の位置は関連する機会空間の周辺を示すもので、個々の競合のシェアや独立スコアではありません。リストは観測範囲であり網羅調査ではありません。</p><section class="market-baseline"><header><div><span class="kicker">COMPETITION BASELINE</span><h3>他の領域がどれだけ混んでいるか</h3></div><span>${observedAlternatives} observed alternatives</span></header><div class="market-baseline-head"><span>#</span><span>機会領域 / 観測代替の例</span><span>代替数</span><span>密度</span><span>飽和度</span><span>WTP</span><span>判定</span></div>${baselineRows}</section><div class="whitespace-ranking"><span class="kicker">ALL CANDIDATES / PROOF STATUS</span>${ranks}</div></article><aside class="whitespace-detail-panel">${details}</aside></section>`;
}

function profitDecisionView(result) {
  const pools=arr(result.profit_pools); if(!pools.length)return '<div class="empty-state"><h2>利益プールはありません</h2></div>';
  const meta=result.metadata?.coverage||{},defaultGeography=textList(meta.regions),defaultHorizon=meta.horizon||state.current?.request?.horizon||'未記録';
  const rows=pools.map((item,index)=>{const definition=item.profit_definition||{},legacy=finiteScore(item.pool_score??item.revenue_pool),actual=definition.actual_value;return {item,index,definition,indexScore:legacy,actual};});
  const direction=value=>{const text=String(value||'').toLowerCase();return text.includes('up')||text.includes('上')?'上昇':text.includes('down')||text.includes('下')?'低下':text.includes('flat')||text.includes('横')?'横ばい':text.includes('mixed')||text.includes('混')?'混在':'未判定';};
  const bars=rows.map(row=>`<button class="profit-row" data-profit-index="${row.index}"><span class="profit-rank">${String(row.index+1).padStart(2,'0')}</span><span class="profit-stage"><b>${esc(row.item.value_chain_stage||row.item.name)}</b><small>${esc(row.item.name)}</small></span><span class="profit-bar"><i style="width:${row.indexScore??0}%"></i></span><strong>${row.indexScore??'—'}</strong><span class="profit-direction ${direction(row.item.margin_direction)==='上昇'?'up':direction(row.item.margin_direction)==='低下'?'down':''}">${direction(row.item.margin_direction)}</span></button>`).join('');
  const cards=rows.map(row=>{const item=row.item,definition=row.definition;return `<article class="profit-card"><header><span class="kicker">${esc(item.value_chain_stage||'VALUE CHAIN')}</span><h3>${esc(item.name)}</h3><span class="profit-score"><b>${row.indexScore??'—'}</b><small>relative index</small></span></header><div class="profit-definition-grid"><span><small>誰の利益か</small><b>${esc(definition.owner||'当該工程の供給事業者')}</b></span><span><small>利益指標</small><b>${esc(definition.metric||'粗利・営業利益の方向性')}</b></span><span><small>実額</small><b class="${row.actual===undefined?'not-calculated':''}">${row.actual===undefined?'未算定':esc(row.actual)}</b></span><span><small>地域 / 時間軸</small><b>${esc(definition.geography||defaultGeography)} · ${esc(definition.horizon||defaultHorizon)}</b></span></div><p class="profit-why">${esc(item.why||'利益移動の説明は未記録です。')}</p><dl><div><dt>利益獲得原理</dt><dd>${esc(item.capture_mechanism||'未記録')}</dd></div><div><dt>参入障壁</dt><dd>${textList(item.barriers)}</dd></div><div><dt>利益を取る側</dt><dd>${textList(item.winners)}</dd></div><div><dt>負担する側</dt><dd>${textList(item.losers)}</dd></div></dl>${evidenceTags(item.evidence_ids)}</article>`;}).join('');
  return `<section class="profit-contract"><div><span class="kicker">PROFIT POOL DEFINITION</span><h2>売上規模ではなく、どの工程の誰が利益を取るか</h2><p>現在の数値は通貨額ではなく、供給集中・切替費用・希少性・マージン方向・成長方向をまとめた相対的な利益獲得力指数です。実利益額がない工程は「未算定」と明記します。</p></div><div class="profit-method"><span><b>OWNER</b>各工程の供給事業者</span><span><b>METRIC</b>相対利益獲得力 0–100</span><span><b>NOT</b>売上高・時価総額・投資リターン</span></div></section><section class="profit-board"><article class="profit-ranking"><header><div><span class="kicker">VALUE CHAIN RENT CAPTURE</span><h2>利益と交渉力が移る工程</h2></div><span>高いほど利益を保持しやすい</span></header><div class="profit-head"><span>#</span><span>工程 / セグメント</span><span>相対利益獲得力</span><span>指数</span><span>粗利方向</span></div>${bars}<footer>指数は比較用。実額比較には各社・各工程の売上、粗利、営業利益、地域、基準年が必要です。</footer></article><aside class="profit-caveat"><span class="kicker">READ BEFORE USE</span><h3>この図で投資判断を完結しない</h3><p>高い利益獲得力でも、株価に既に織り込まれていれば投資収益は別です。投資ルートでは、期待差・バリュエーション・触媒・下落要因を追加確認します。</p></aside></section><section class="profit-card-grid">${cards}</section>`;
}

function simulationView(result) {
  const graph=result.knowledge_graph||{nodes:[],edges:[]}, lab=result.simulation_lab||{}, runSimulation=state.current?.simulation||{};
  const status=runSimulation.status?.state||lab.status||'not_requested', pending=['pending_codex','running'].includes(status), complete=lab.status==='complete'&&!pending;
  const types=[...new Set(arr(graph.nodes).map(node=>node.type).filter(Boolean))];
  const stages=[
    ['01','Seed / Graph','準備済み',`${arr(result.evidence).length} evidence · ${arr(graph.nodes).length} nodes · ${arr(graph.edges).length} edges`],
    ['02','World / Personas',arr(lab.agents).length?'生成済み':pending?'実行待ち':'未生成',arr(lab.agents).length?`${arr(lab.agents).length} agents`:'主体・役割・行動ルールを生成'],
    ['03','Agent Simulation',lab.rounds?'実行済み':status==='running'?'実行中':'未実行',lab.rounds?`${lab.rounds} rounds`:'履歴を保持する複数主体シミュレーション'],
    ['04','ReportAgent',lab.report?'生成済み':'未生成',lab.report?'合成結果を集約済み':'創発事象・分岐・反証を報告へ変換'],
    ['05','Deep Interaction',arr(lab.interactions).length?'利用可能':'未実行',arr(lab.interactions).length?`${arr(lab.interactions).length} interactions`:'主体・報告への追跡質問は次段階']
  ];
  const statusLabel=complete?'SIMULATION COMPLETE':status==='running'?'CODEX RUNNING':status==='pending_codex'?'PENDING CODEX':'NOT REQUESTED';
  const prompt=runSimulation.request?.codex_prompt||'';
  const executionPanel=complete?`<article class="simulation-input"><span class="kicker">INTERNAL CODEX RUN</span><h3>シミュレーション結果を同じrunに保存済み</h3><p>Codexが証拠境界を維持したまま複数主体を合成し、結果をSimulation Labへ反映しました。外部JSONの受け渡しは不要です。</p><div class="simulation-actions"><button id="simulation-request" class="small-button">再実行依頼を作成</button><button class="small-button" data-simulation-refresh>状態を更新</button></div></article>`:pending?`<article class="simulation-input"><span class="kicker">CODEX HANDOFF / NO API KEY</span><h3>${status==='running'?'Codexがシミュレーションを実行中':'同じrun内に実行依頼を保存しました'}</h3><p>追加のAI APIキーは不要です。Codex Desktopで次の依頼を実行すると、結果はこの画面へ戻ります。</p><code class="simulation-prompt">${esc(prompt)}</code><div class="simulation-actions"><button class="small-button primary" data-copy-simulation="${esc(prompt)}">Codex依頼をコピー</button><button class="small-button" data-simulation-refresh>結果を確認</button></div></article>`:`<article class="simulation-input"><span class="kicker">INTERNAL CODEX RUN / NO API KEY</span><h3>この分析を複数主体でストレステスト</h3><p>外部MiroFishやseedファイルを使わず、Codexがこのrunの証拠・グラフ・シナリオから合成実験を実行します。</p><div class="simulation-config"><label>主体数<input id="simulation-agent-count" type="number" min="4" max="24" value="10"></label><label>ラウンド数<input id="simulation-round-count" type="number" min="3" max="12" value="6"></label><label class="wide">検証目的<textarea id="simulation-objective" rows="2" placeholder="例：電力接続遅延とAI需要鈍化が同時に起きた場合の頑健な戦略"></textarea></label></div><div class="simulation-actions"><button id="simulation-request" class="small-button primary">Codexシミュレーション依頼を作成</button></div></article>`;
  const agentPanel=complete?`<section class="simulation-results"><header><span class="kicker">AGENT SOCIETY</span><h3>${arr(lab.agents).length}主体の目的・制約・判断規則</h3></header><div class="simulation-agent-grid">${arr(lab.agents).map(agent=>`<article><span>${esc(agent.archetype||agent.role||'AGENT')}</span><h4>${esc(agent.name)}</h4><p><b>目的</b>${esc(agent.objective)}</p><p><b>制約</b>${textList(agent.constraints)}</p><p><b>判断規則</b>${textList(agent.decision_rules)}</p>${evidenceTags(agent.evidence_ids)}</article>`).join('')}</div></section>`:'';
  const roundPanel=complete?`<section class="simulation-results"><header><span class="kicker">ROUND LOG / PATH DEPENDENCE</span><h3>${lab.rounds}ラウンドの相互作用</h3></header><div class="simulation-rounds">${arr(lab.round_log).map(round=>`<article><i>${String(round.round||'').padStart(2,'0')}</i><div><span>${esc(round.focus||'ROUND')}</span><h4>${esc(round.summary||round.title||'状態更新')}</h4><p><b>行動・相互作用</b>${textList(round.actions||round.interactions)}</p><p><b>状態変化</b>${textList(round.state_changes)}</p><p><b>少数見解</b>${textList(round.minority_views)}</p>${evidenceTags(round.evidence_ids)}</div></article>`).join('')}</div></section>`:'';
  const eventPanel=complete?`<section class="simulation-result-grid"><article class="simulation-result-block"><span class="kicker">EMERGENT EVENTS</span><h3>事前シナリオに固定されない創発</h3>${arr(lab.emergent_events).map(event=>`<div class="simulation-event"><b>${esc(event.title)}</b><span>${pct(event.probability)}% synthetic weight</span><p>${esc(event.description)}</p><small>Trigger: ${esc(event.trigger||'—')}</small>${evidenceTags(event.evidence_ids)}</div>`).join('')||'<p>記録なし</p>'}</article><article class="simulation-result-block"><span class="kicker">INTERVENTION TESTS</span><h3>介入と対照実験</h3>${arr(lab.interventions).map(item=>`<div class="simulation-event"><b>${esc(item.name)}</b><span>${esc(item.result||item.effect||'')}</span><p>${esc(item.description||item.expected_effect)}</p><small>Risk: ${textList(item.risks)}</small>${evidenceTags(item.evidence_ids)}</div>`).join('')||'<p>記録なし</p>'}</article></section>`:'';
  const outcomePanel=complete?`<section class="simulation-results"><header><span class="kicker">SYNTHETIC OUTCOME DISTRIBUTION</span><h3>分岐別の結果と先行指標</h3></header><div class="simulation-outcomes">${arr(lab.outcomes).map(item=>`<article><strong>${pct(item.probability)}%</strong><h4>${esc(item.scenario||item.name)}</h4><p>${esc(item.narrative)}</p><small>勝者: ${textList(item.winners)}</small><small>敗者: ${textList(item.losers)}</small><small>先行指標: ${textList(item.signposts)}</small>${evidenceTags(item.evidence_ids)}</article>`).join('')}</div></section>`:'';
  const report=complete&&typeof lab.report==='object'?`<section class="simulation-report"><header><span class="kicker">REPORT AGENT</span><h3>合成実験から得た意思決定</h3></header><p class="simulation-report-lead">${esc(lab.report.executive_summary)}</p><div><article><b>複数分岐で頑健</b>${arr(lab.report.robust_actions).map(x=>`<p>↳ ${esc(x)}</p>`).join('')}</article><article><b>条件付きで実行</b>${arr(lab.report.contingent_actions).map(x=>`<p>↳ ${esc(x)}</p>`).join('')}</article><article><b>避ける行動</b>${arr(lab.report.avoid).map(x=>`<p>↳ ${esc(x)}</p>`).join('')}</article><article><b>反証条件</b>${arr(lab.falsifiers).map(x=>`<p>↳ ${esc(typeof x==='string'?x:x.condition||x.description)}</p>`).join('')}</article></div><footer>SYNTHETIC — これは観測事実や投資推奨ではなく、意思決定を壊しにいく合成実験です。</footer></section>`:'';
  return `<section class="simulation-header"><div><span class="kicker">OPPORTUNITY INTELLIGENCE / SIMULATION LAB</span><h2>証拠から世界モデルを作り、複数主体の反応を試す</h2><p>MiroFishの世界モデル・主体相互作用・介入実験を参考に、Codexを実行基盤としてツール内に実装した個人利用機能です。一次情報・推論・合成結果を混ぜません。</p></div><div class="simulation-state ${complete?'complete':'pending'}"><span>STATUS</span><b>${statusLabel}</b><small>${complete?'合成結果あり':pending?'同じrunで処理待ち':'入力条件を設定できます'}</small></div></section>
  <section class="simulation-pipeline">${stages.map(([id,name,status,detail],index)=>`<article class="${index===0||complete?'ready':'pending'}"><i>${id}</i><span>${name}</span><b>${status}</b><small>${detail}</small></article>`).join('')}</section>
  <section class="simulation-grid">${executionPanel}<article class="simulation-boundary"><span class="kicker">EVIDENCE BOUNDARY</span><h3>この実験の読み方</h3><ul><li>主体の発言・相互作用・創発事象はすべて合成結果です。</li><li>確率は観測統計ではなく、分岐を比較するためのsynthetic weightです。</li><li>実在企業の将来行動を断定せず、証拠IDで拘束された意思決定仮説として読みます。</li></ul><div class="simulation-metrics"><span><b>${arr(result.evidence).length}</b>証拠</span><span><b>${arr(graph.nodes).length}</b>要因</span><span><b>${arr(graph.edges).length}</b>因果</span><span><b>${arr(result.scenarios).length}</b>事前分岐</span></div><div class="world-types">${types.map(type=>`<span>${esc(type)} <b>${arr(graph.nodes).filter(node=>node.type===type).length}</b></span>`).join('')}</div></article></section>
  ${agentPanel}${roundPanel}${eventPanel}${outcomePanel}${report}
  <section class="simulation-seeds"><header><span class="kicker">SCENARIO PRIORS / BEFORE SIMULATION</span><h3>実験前の初期世界</h3></header><div>${arr(result.scenarios).map(item=>`<article><b>${esc(item.name)}</b><span>${pct(item.probability)}% prior</span><p>${esc(item.narrative||item.description)}</p></article>`).join('')||'<p>シナリオseedはありません。</p>'}</div></section>`;
}

init();
