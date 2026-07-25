const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compileRequest } = require('./lib/compiler.cjs');
const { validateRequest, validateResult } = require('./lib/validation.cjs');
const { executeConnector } = require('./lib/connectors.cjs');
const { writeJsonAtomic, readJson, safeRunId } = require('./lib/store.cjs');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const RUNS = process.env.DIW_RUNS_DIR ? path.resolve(process.env.DIW_RUNS_DIR) : path.join(ROOT, 'runs');
const PORT = Number(process.env.DIW_PORT || 4317);
const HOST = process.env.DIW_HOST || '127.0.0.1';
const catalog = readJson(path.join(ROOT, 'config', 'catalog.json'));
const connectorConfig = readJson(path.join(ROOT, 'config', 'connectors.json'));
fs.mkdirSync(RUNS, { recursive: true });

const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

function send(res, status, value, headers = {}) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  res.writeHead(status, { 'Content-Type': headers['Content-Type'] || 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control':'no-store', ...headers });
  res.end(body);
}

async function bodyJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 2_000_000) throw new Error('request body exceeds 2 MB'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('invalid JSON body'); }
}

function runPath(id, file) { return path.join(RUNS, safeRunId(id), file); }

function listRuns() {
  return fs.readdirSync(RUNS, { withFileTypes:true }).filter(item => item.isDirectory() && !item.name.startsWith('.')).map(item => {
    const request = readJson(runPath(item.name, 'request.json'), {});
    const status = readJson(runPath(item.name, 'status.json'), { state:'unknown' });
    return { id:item.name, title:request.query || item.name, created_at:request.created_at, status };
  }).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getRun(id) {
  safeRunId(id);
  if (!fs.existsSync(path.join(RUNS, id))) return null;
  return { id, request:readJson(runPath(id, 'request.json')), status:readJson(runPath(id, 'status.json')), result:readJson(runPath(id, 'result.json')), forecast_log:readJson(runPath(id, 'forecast-log.json'), {}) };
}

function trashRun(id) {
  const safeId = safeRunId(id);
  const source = path.join(RUNS, safeId);
  if (!fs.existsSync(source)) return null;
  const trash = path.join(RUNS, '.trash');
  fs.mkdirSync(trash, { recursive:true });
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const target = path.join(trash, `${safeId}-${suffix}`);
  fs.renameSync(source, target);
  return { id:safeId, deleted:true, recoverable:true };
}

function aggregateForecasts() {
  return listRuns().flatMap(run => {
    const result=readJson(runPath(run.id,'result.json'),{}); const log=readJson(runPath(run.id,'forecast-log.json'),{});
    return (result.forecasts||[]).map(forecast=>({run_id:run.id,run_title:run.title,...forecast,history:log[forecast.id]?.history||[],resolution:log[forecast.id]?.resolution||null}));
  });
}

function executionNote(id, compiled) {
  return `# Codexでこの分析を実行\n\nDecision Intelligence Workbench の実行待ち依頼です。\n\n- Run ID: \`${id}\`\n- 依頼: ${compiled.query}\n- 状態: \`pending_codex\`\n\nCodexで次のように依頼してください。\n\n> Decision Intelligence Workbench の保留中run \`${id}\` を、run-decision-intelligenceスキルで実行して。\n\nCodexは \`request.json\` を読み、現在の一次情報を調査し、\`result.json\` を検証後に保存します。追加のAI APIキーは不要ですが、Codexデスクトップ内でこの処理を実行する必要があります。\n`;
}

function buildMirofishPayload(id, request, result) {
  const evidence = (result.evidence || []).map(item => ({
    id:item.id, title:item.title, url:item.url, publisher:item.publisher,
    source_tier:item.source_tier, statement_type:item.statement_type,
    supports:item.supports, limitations:item.limitations
  }));
  return {
    schema_version:'1.0',
    run_id:id,
    classification:'synthetic_scenario_input',
    question:request.query,
    horizon:request.horizon,
    regions:request.regions,
    sectors:request.sectors,
    seed_evidence:evidence,
    scenario_priors:result.scenarios || [],
    knowledge_graph:result.knowledge_graph || { nodes:[], edges:[] },
    intervention_candidates:(result.knowledge_graph?.nodes || []).filter(node => ['driver','risk','policy','technology'].includes(node.type)).slice(0,12),
    provenance_rules:[
      'Simulation output is synthetic and must never be presented as an observed fact.',
      'Preserve evidence IDs and source URLs when a simulated claim depends on a seed.',
      'Separate observed evidence, analyst inference, model assumption, and emergent simulation output.',
      'Return falsifiers, regime changes, and minority-agent outcomes, not only the consensus path.'
    ],
    exported_at:new Date().toISOString()
  };
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok:true, product:'Decision Intelligence Workbench', version:'0.1.0', time:new Date().toISOString(), ai_runtime:'codex_desktop_handoff' });
  if (req.method === 'GET' && url.pathname === '/api/catalog') return send(res, 200, { ...catalog, connector_states:connectorConfig.state_definitions });
  if (req.method === 'GET' && url.pathname === '/api/connectors') return send(res, 200, connectorConfig);
  if (req.method === 'GET' && url.pathname === '/api/runs') return send(res, 200, { runs:listRuns() });
  if (req.method === 'GET' && url.pathname === '/api/forecasts') return send(res, 200, { forecasts:aggregateForecasts() });

  if (req.method === 'POST' && url.pathname === '/api/requests') {
    const input = await bodyJson(req); const errors = validateRequest(input);
    if (errors.length) return send(res, 422, { error:'invalid_request', details:errors });
    const id = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0,14)}-${crypto.randomBytes(3).toString('hex')}`;
    const compiled = { id, ...compileRequest(input, catalog) };
    const dir = path.join(RUNS, id); fs.mkdirSync(dir, { recursive:true });
    writeJsonAtomic(path.join(dir, 'request.json'), compiled);
    writeJsonAtomic(path.join(dir, 'status.json'), { state:'pending_codex', created_at:compiled.created_at, updated_at:compiled.created_at, message:'Codexによる証拠調査と分析を待っています。' });
    fs.writeFileSync(path.join(dir, 'EXECUTE_WITH_CODEX.md'), executionNote(id, compiled), 'utf8');
    return send(res, 201, getRun(id));
  }

  if (parts[0] === 'api' && parts[1] === 'runs' && parts[2]) {
    const id = safeRunId(parts[2]); const existing = getRun(id);
    if (!existing) return send(res, 404, { error:'run_not_found' });
    if (req.method === 'GET' && parts.length === 3) return send(res, 200, existing);
    if (req.method === 'DELETE' && parts.length === 3) return send(res, 200, trashRun(id));
    if (req.method === 'POST' && parts[3] === 'result') {
      const result = await bodyJson(req); const errors = validateResult(result, id);
      if (errors.length) return send(res, 422, { error:'invalid_result', details:errors });
      writeJsonAtomic(runPath(id, 'result.json'), result);
      writeJsonAtomic(runPath(id, 'status.json'), { state:'complete', created_at:existing.status?.created_at || existing.request.created_at, updated_at:new Date().toISOString(), message:'検証済み分析結果を保存しました。' });
      return send(res, 200, getRun(id));
    }
    if (parts[3] === 'mirofish' && parts[4] === 'export' && req.method === 'POST') {
      if (!existing.result) return send(res, 409, { error:'run_not_complete' });
      const payload=buildMirofishPayload(id, existing.request, existing.result);
      writeJsonAtomic(runPath(id,'mirofish-input.json'),payload);
      return send(res,200,{run_id:id,classification:payload.classification,download_url:`/api/runs/${encodeURIComponent(id)}/mirofish/input`,counts:{evidence:payload.seed_evidence.length,nodes:payload.knowledge_graph.nodes.length,edges:payload.knowledge_graph.edges.length,scenarios:payload.scenario_priors.length}});
    }
    if (parts[3] === 'mirofish' && parts[4] === 'input' && req.method === 'GET') {
      const payload=readJson(runPath(id,'mirofish-input.json'));
      if (!payload) return send(res,404,{error:'mirofish_input_not_found'});
      return send(res,200,payload,{'Content-Disposition':`attachment; filename="${id}-mirofish-input.json"`});
    }
    if (req.method === 'POST' && parts[3] === 'forecasts' && parts[4] && ['updates','resolve'].includes(parts[5])) {
      if (!existing.result) return send(res, 409, { error:'run_not_complete' });
      const forecastId=safeRunId(parts[4]); const forecast=(existing.result.forecasts||[]).find(item=>item.id===forecastId);
      if (!forecast) return send(res,404,{error:'forecast_not_found'});
      const input=await bodyJson(req); const log=existing.forecast_log||{}; const entry=log[forecastId]||{history:[]};
      if (parts[5]==='updates') {
        const probability=Number(input.probability); if(!Number.isFinite(probability)||probability<0||probability>1) return send(res,422,{error:'probability_must_be_0_to_1'});
        entry.history.push({probability,note:String(input.note||''),recorded_at:new Date().toISOString()});
      } else {
        if (![0,1].includes(Number(input.outcome))) return send(res,422,{error:'outcome_must_be_0_or_1'});
        const probability=entry.history.at(-1)?.probability ?? Number(forecast.probability);
        const normalized=probability>1?probability/100:probability;
        entry.resolution={outcome:Number(input.outcome),resolved_at:new Date().toISOString(),source_url:String(input.source_url||''),note:String(input.note||''),brier_score:Number(((normalized-Number(input.outcome))**2).toFixed(4))};
      }
      log[forecastId]=entry; writeJsonAtomic(runPath(id,'forecast-log.json'),log); return send(res,200,getRun(id));
    }
  }

  if (parts[0] === 'api' && parts[1] === 'connectors' && parts[2] && parts[3] === 'query' && req.method === 'POST') {
    const connector = connectorConfig.connectors.find(item => item.id === parts[2]);
    if (!connector) return send(res, 404, { error:'connector_not_found' });
    try { return send(res, 200, await executeConnector(parts[2], await bodyJson(req))); }
    catch (error) { return send(res, 502, { error:'connector_query_failed', message:error.message, connector_state:connector.state }); }
  }
  return send(res, 404, { error:'api_not_found' });
}

function staticFile(req, res, url) {
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const target = path.resolve(PUBLIC, relative);
  if (!target.startsWith(path.resolve(PUBLIC) + path.sep) && target !== path.join(PUBLIC, 'index.html')) return send(res, 403, { error:'forbidden' });
  fs.readFile(target, (error, data) => {
    if (error) return send(res, error.code === 'ENOENT' ? 404 : 500, { error:'file_error' });
    send(res, 200, data, { 'Content-Type':MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (!['GET','HEAD'].includes(req.method)) return send(res, 405, { error:'method_not_allowed' });
    return staticFile(req, res, url);
  } catch (error) { console.error(error); return send(res, 500, { error:'internal_error', message:error.message }); }
});

server.listen(PORT, HOST, () => {
  console.log(`Decision Intelligence Workbench: http://${HOST}:${PORT}`);
  console.log('AI execution mode: Codex desktop handoff (no separate AI API key)');
});

module.exports = { server, listRuns, getRun };
