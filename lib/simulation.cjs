const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJsonAtomic, safeRunId } = require('./store.cjs');

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function buildSimulationRequest(id, request, result, options = {}) {
  const runId = safeRunId(id);
  const createdAt = new Date().toISOString();
  const agentCount = clampInteger(options.agent_count, 10, 4, 24);
  const rounds = clampInteger(options.rounds, 6, 3, 12);
  return {
    schema_version: '1.0',
    run_id: runId,
    status: 'pending_codex',
    classification: 'synthetic_scenario_request',
    engine: 'codex_mirofish_method',
    created_at: createdAt,
    objective: String(options.objective || `「${request.query}」の意思決定を、複数主体の相互作用と介入実験でストレステストする。`),
    configuration: {
      agent_count: agentCount,
      rounds,
      include_minority_views: true,
      include_counterfactuals: true,
      preserve_evidence_boundary: true
    },
    requested_intervention: options.intervention && typeof options.intervention === 'object' ? {
      name: String(options.intervention.name || '追加介入'),
      variable: String(options.intervention.variable || ''),
      change: String(options.intervention.change || ''),
      rationale: String(options.intervention.rationale || '')
    } : null,
    seed: {
      question: request.query,
      horizon: request.horizon,
      regions: request.regions || [],
      sectors: request.sectors || [],
      evidence: (result.evidence || []).map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source_tier: item.source_tier,
        statement_type: item.statement_type,
        supports: item.supports,
        limitations: item.limitations
      })),
      scenarios: result.scenarios || [],
      knowledge_graph: result.knowledge_graph || { nodes: [], edges: [] },
      megatrends: result.megatrends || [],
      whitespaces: result.whitespaces || [],
      market_landscape: result.market_landscape || { entities: [] }
    },
    output_requirements: [
      'Treat every simulated observation as synthetic, never as an observed fact.',
      'Create distinct agents with objectives, constraints, decision rules, and evidence anchors.',
      'Run sequential rounds with state changes, interactions, minority views, and path dependence.',
      'Test at least two interventions and one counterfactual control.',
      'For every round, return agent_states with stance, memory_delta, current_goal, confidence, and active relationships.',
      'Classify interaction edges as negotiation, investment, refusal, cooperation, regulation, information, or competition.',
      'Return a branch_tree that links triggering events to outcomes and preserves minority branches.',
      'Return emergent events, robust actions, contingent actions, falsifiers, and limitations.',
      'Preserve evidence IDs whenever a seed fact constrains an agent or event.'
    ],
    codex_prompt: `Opportunity Intelligence のrun ${runId} の保留中シミュレーションを、run-opportunity-simulationスキルで実行して。`
  };
}

function answerSimulationQuestion(simulation, targetId, question) {
  const target = String(targetId || 'report-agent');
  const prompt = String(question || '').trim();
  if (!prompt) throw new Error('question is required');
  if (prompt.length > 1000) throw new Error('question must be 1000 characters or fewer');
  const agents = simulation.agents || [];
  const interactions = simulation.interactions || [];
  const report = simulation.report || {};
  let targetName = '意思決定レポート';
  let answer;
  let evidenceIds = [];

  if (target === 'report-agent') {
    const riskQuestion = /リスク|避け|失敗|反証|崩|弱点/.test(prompt);
    const actionQuestion = /行動|何を|どうす|実行|投資|判断/.test(prompt);
    const selected = riskQuestion ? (report.avoid || []) : actionQuestion ? [...(report.robust_actions || []), ...(report.contingent_actions || [])] : [];
    answer = [report.executive_summary, ...selected.slice(0, 5)].filter(Boolean).join('\n・') || '保存済みレポートに、この質問へ直接対応する記録がありません。追加推論には再シミュレーションが必要です。';
    evidenceIds = [...new Set((simulation.round_log || []).flatMap(round => round.evidence_ids || []))].slice(0, 12);
  } else {
    const agent = agents.find(item => item.id === target);
    if (!agent) throw new Error('simulation agent not found');
    targetName = agent.name;
    const related = interactions.filter(item => item.from === target || item.to === target);
    const recent = related.at(-1);
    answer = [
      `目的: ${agent.objective}`,
      `制約: ${(agent.constraints || []).join(' / ') || '記録なし'}`,
      `判断規則: ${(agent.decision_rules || []).join(' / ') || '記録なし'}`,
      recent ? `直近の相互作用: Round ${recent.round}「${recent.topic}」— ${recent.summary}` : '相互作用記録: なし'
    ].join('\n');
    evidenceIds = [...new Set([...(agent.evidence_ids || []), ...related.flatMap(item => item.evidence_ids || [])])];
  }
  return {
    id:`chat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    target_id:target,
    target_name:targetName,
    question:prompt,
    answer,
    classification:'synthetic_explanation',
    evidence_ids:evidenceIds,
    created_at:new Date().toISOString(),
    boundary:'保存済みシミュレーションからの説明です。新しい事実の検索や追加シミュレーションは行っていません。'
  };
}

function validateSimulation(simulation, expectedRunId, evidenceIds = new Set()) {
  const errors = [];
  if (!simulation || typeof simulation !== 'object') return ['simulation must be an object'];
  if (simulation.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (simulation.run_id !== expectedRunId) errors.push(`run_id must equal ${expectedRunId}`);
  if (simulation.classification !== 'synthetic') errors.push('classification must be synthetic');
  if (simulation.engine !== 'codex_mirofish_method') errors.push('engine must be codex_mirofish_method');
  if (!simulation.generated_at) errors.push('generated_at is required');
  if (!simulation.environment || typeof simulation.environment !== 'object') errors.push('environment is required');
  if (!Array.isArray(simulation.agents) || simulation.agents.length < 4) errors.push('agents must contain at least 4 agents');
  if (!Number.isInteger(simulation.rounds) || simulation.rounds < 1) errors.push('rounds must be a positive integer');
  if (!Array.isArray(simulation.round_log) || simulation.round_log.length !== simulation.rounds) errors.push('round_log length must equal rounds');
  for (const key of ['interactions', 'emergent_events', 'interventions', 'outcomes', 'falsifiers', 'limitations']) {
    if (!Array.isArray(simulation[key])) errors.push(`${key} must be an array`);
  }
  for (const key of ['agent_states', 'intervention_comparisons']) {
    if (simulation[key] !== undefined && !Array.isArray(simulation[key])) errors.push(`${key} must be an array when provided`);
  }
  if (simulation.branch_tree !== undefined && (simulation.branch_tree === null || typeof simulation.branch_tree !== 'object' || Array.isArray(simulation.branch_tree))) errors.push('branch_tree must be an object when provided');
  if (!simulation.report || typeof simulation.report !== 'object') errors.push('report is required');
  const agentIds = new Set();
  for (const [index, agent] of (simulation.agents || []).entries()) {
    if (!agent?.id) errors.push(`agents[${index}].id is required`);
    if (agentIds.has(agent?.id)) errors.push(`duplicate agent id: ${agent.id}`);
    agentIds.add(agent?.id);
    if (!agent?.name || !agent?.objective || !Array.isArray(agent?.decision_rules)) errors.push(`agents[${index}] requires name, objective, and decision_rules`);
  }
  const references = [];
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(collect);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'evidence_ids' && Array.isArray(child)) references.push(...child);
      else collect(child);
    }
  };
  collect(simulation);
  for (const id of references) if (!evidenceIds.has(id)) errors.push(`unknown evidence reference: ${id}`);
  return [...new Set(errors)];
}

function completeSimulation(runsRoot, id, simulation) {
  const runId = safeRunId(id);
  const root = path.join(runsRoot, runId);
  const resultPath = path.join(root, 'result.json');
  const result = readJson(resultPath);
  if (!result) throw new Error(`completed analysis not found: ${runId}`);
  const evidenceIds = new Set((result.evidence || []).map(item => item.id));
  const errors = validateSimulation(simulation, runId, evidenceIds);
  if (errors.length) return { valid: false, errors };
  writeJsonAtomic(path.join(root, 'simulation-result.json'), simulation);
  writeJsonAtomic(path.join(root, 'simulation-status.json'), {
    state: 'complete',
    updated_at: new Date().toISOString(),
    message: 'Codexによる合成シミュレーションを検証して保存しました。'
  });
  result.simulation_lab = {
    status: 'complete',
    source_classification: 'synthetic',
    engine: simulation.engine,
    generated_at: simulation.generated_at,
    environment: simulation.environment,
    agents: simulation.agents,
    rounds: simulation.rounds,
    round_log: simulation.round_log,
    interactions: simulation.interactions,
    agent_states: simulation.agent_states || [],
    branch_tree: simulation.branch_tree || null,
    intervention_comparisons: simulation.intervention_comparisons || [],
    emergent_events: simulation.emergent_events,
    interventions: simulation.interventions,
    outcomes: simulation.outcomes,
    falsifiers: simulation.falsifiers,
    report: simulation.report,
    limitations: simulation.limitations
  };
  writeJsonAtomic(resultPath, result);
  return { valid: true, result, simulation };
}

module.exports = { buildSimulationRequest, validateSimulation, completeSimulation, answerSimulationQuestion };
