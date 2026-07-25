const REQUIRED_ARRAYS = ['megatrends', 'whitespaces', 'profit_pools', 'investment_routes', 'business_routes', 'scenarios', 'forecasts', 'evidence', 'counterarguments', 'methodology', 'limitations'];

function validateRequest(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('request body must be an object');
  if (String(body?.query || '').trim().length < 5) errors.push('query must contain at least 5 characters');
  for (const key of ['regions', 'sectors', 'decision_types', 'methods']) {
    if (body?.[key] != null && !Array.isArray(body[key])) errors.push(`${key} must be an array`);
  }
  return errors;
}

function validateEvidence(evidence, errors) {
  const ids = new Set();
  evidence.forEach((item, index) => {
    if (!item?.id) errors.push(`evidence[${index}].id is required`);
    if (ids.has(item?.id)) errors.push(`duplicate evidence id: ${item.id}`);
    ids.add(item?.id);
    if (!item?.title) errors.push(`evidence[${index}].title is required`);
    if (!item?.url) errors.push(`evidence[${index}].url is required`);
    if (!['primary', 'official_secondary', 'academic', 'industry', 'community', 'synthetic'].includes(item?.source_tier)) errors.push(`evidence[${index}].source_tier is invalid`);
    if (!['fact', 'inference', 'assumption', 'unknown'].includes(item?.statement_type)) errors.push(`evidence[${index}].statement_type is invalid`);
  });
  return ids;
}

function collectEvidenceReferences(value, refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (Array.isArray(value)) { value.forEach(item => collectEvidenceReferences(item, refs)); return refs; }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'evidence_ids' && Array.isArray(child)) refs.push(...child);
    else collectEvidenceReferences(child, refs);
  }
  return refs;
}

function validateResult(result, expectedRunId) {
  const errors = [];
  if (!result || typeof result !== 'object') return ['result must be an object'];
  if (result.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (!result.metadata?.run_id) errors.push('metadata.run_id is required');
  if (expectedRunId && result.metadata?.run_id !== expectedRunId) errors.push(`metadata.run_id must equal ${expectedRunId}`);
  if (!result.metadata?.title) errors.push('metadata.title is required');
  if (!result.metadata?.generated_at) errors.push('metadata.generated_at is required');
  if (!result.executive?.one_line) errors.push('executive.one_line is required');
  if (!Array.isArray(result.executive?.decision_spine)) errors.push('executive.decision_spine must be an array');
  if (!result.knowledge_graph || !Array.isArray(result.knowledge_graph.nodes) || !Array.isArray(result.knowledge_graph.edges)) errors.push('knowledge_graph.nodes and edges are required arrays');
  for (const key of REQUIRED_ARRAYS) if (!Array.isArray(result[key])) errors.push(`${key} must be an array`);
  if (Array.isArray(result.forecasts)) result.forecasts.forEach((item,index) => {
    if (!item?.id) errors.push(`forecasts[${index}].id is required`);
    if (!item?.question) errors.push(`forecasts[${index}].question is required`);
    if (!item?.resolution_date) errors.push(`forecasts[${index}].resolution_date is required`);
    if (!Number.isFinite(Number(item?.probability))) errors.push(`forecasts[${index}].probability must be numeric`);
    if (!item?.resolution_criteria) errors.push(`forecasts[${index}].resolution_criteria is required`);
  });
  if (Array.isArray(result.whitespaces)) result.whitespaces.forEach((item,index) => {
    if (item?.classification !== 'white') return;
    const competition = item.competition || {};
    const wtpVerified = competition.wtp_verified === true || item.potential?.wtp_verified === true;
    if (!Array.isArray(competition.current_alternatives) || !competition.current_alternatives.length) errors.push(`whitespaces[${index}] classified white requires observed alternatives`);
    if (!['low','medium','high'].includes(competition.density)) errors.push(`whitespaces[${index}] classified white requires competition density`);
    if (!Number.isFinite(Number(competition.saturation_score)) || !Number.isFinite(Number(competition.unmet_need_score))) errors.push(`whitespaces[${index}] classified white requires saturation and unmet-need scores`);
    if (!competition.gap && !competition.documented_gap) errors.push(`whitespaces[${index}] classified white requires a documented gap`);
    if (!Array.isArray(competition.evidence_ids) || !competition.evidence_ids.length) errors.push(`whitespaces[${index}] classified white requires competition evidence`);
    if (!wtpVerified) errors.push(`whitespaces[${index}] classified white requires wtp_verified=true`);
  });
  if (Array.isArray(result.methodology)) result.methodology.forEach((item,index) => {
    if (!item || typeof item !== 'object') return errors.push(`methodology[${index}] must be an object`);
    if (item.method_id != null) {
      if (!String(item.method_id).trim()) errors.push(`methodology[${index}].method_id is required`);
      if (!String(item.summary || '').trim()) errors.push(`methodology[${index}].summary is required`);
      if (!Array.isArray(item.steps_applied) || !item.steps_applied.length) errors.push(`methodology[${index}].steps_applied must be a non-empty array`);
      if (!Array.isArray(item.outputs_touched) || !item.outputs_touched.length) errors.push(`methodology[${index}].outputs_touched must be a non-empty array`);
      if (!String(item.departures || '').trim()) errors.push(`methodology[${index}].departures is required`);
    }
  });
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  const evidenceIds = validateEvidence(evidence, errors);
  const refs = collectEvidenceReferences({...result, evidence: undefined});
  for (const id of refs) if (!evidenceIds.has(id)) errors.push(`unknown evidence reference: ${id}`);
  return [...new Set(errors)];
}

module.exports = { validateRequest, validateResult };
