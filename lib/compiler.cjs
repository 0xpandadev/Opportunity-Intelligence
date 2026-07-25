const REGION_RULES = {
  global: ['世界', 'global', 'worldwide', '国際'], europe: ['欧州', 'eu', 'europe'], china: ['中国', 'china'],
  japan: ['日本', 'japan'], north_america: ['米国', '北米', 'usa', 'united states', 'america'],
  latin_america: ['南米', '中南米', 'latin america', 'latam'], africa: ['アフリカ', 'africa']
};

const SECTOR_RULES = {
  industry: ['産業', '製造', '工場', 'manufactur', 'industrial'], agriculture: ['農業', '食料', '食品', 'agri', 'food'],
  materials: ['材料', '素材', '鉱物', '金属', 'material', 'mineral', 'metal'], energy: ['エネルギー', '電力', 'energy', 'power'],
  technology: ['テック', '技術', 'ai', '半導体', 'software', 'technology', 'semiconductor'],
  healthcare: ['医療', 'ヘルス', '製薬', 'health', 'pharma'], built_environment: ['建設', '不動産', '都市', 'construction', 'real estate'],
  mobility_logistics: ['物流', '輸送', '自動車', 'mobility', 'logistics'], finance: ['金融', '銀行', '保険', 'finance'],
  circular_economy: ['循環', 'リサイクル', 'circular', 'recycl']
};

const DECISION_RULES = {
  investment: ['株', '投資', '銘柄', 'バリュエーション', 'stock', 'invest', 'portfolio'],
  business: ['事業', '新規事業', '顧客', '商品', '起業', 'business', 'product', 'customer'],
  policy: ['政策', '規制', '法令', 'policy', 'regulation'], strategy: ['戦略', '市場', '競争', 'strategy', 'market']
};

function matchRules(text, rules) {
  const normalized = text.toLowerCase();
  return Object.entries(rules).filter(([, words]) => words.some(word => normalized.includes(word.toLowerCase()))).map(([id]) => id);
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function compileRequest(input, catalogs) {
  const query = String(input.query || '').trim();
  const inferredRegions = matchRules(query, REGION_RULES);
  const inferredSectors = matchRules(query, SECTOR_RULES);
  const inferredDecisions = matchRules(query, DECISION_RULES);
  const regions = unique([...(input.regions || []), ...inferredRegions]);
  const sectors = unique([...(input.sectors || []), ...inferredSectors]);
  const decisionTypes = unique([...(input.decision_types || []), ...inferredDecisions]);
  const horizon = String(input.horizon || (query.match(/20\d{2}/)?.[0] || '3-10 years'));
  const defaultMethods = ['horizon_scanning', 'steep', 'causal_mapping', 'reference_class', 'scenario_planning', 'whitespace', 'profit_pool', 'falsifiers'];
  const requestedMethods = unique([...(input.methods || []), ...defaultMethods]);

  return {
    schema_version: '1.0', query, created_at: new Date().toISOString(),
    decision_types: decisionTypes.length ? decisionTypes : ['strategy', 'investment', 'business'],
    regions: regions.length ? regions : ['global'], sectors: sectors.length ? sectors : ['cross_sector'], horizon,
    constraints: String(input.constraints || '').trim(),
    requested_methods: requestedMethods,
    required_outputs: ['executive', 'megatrends', 'knowledge_graph', 'whitespaces', 'profit_pools', 'investment_routes', 'business_routes', 'scenarios', 'simulation_lab', 'forecasts', 'evidence', 'counterarguments', 'methodology', 'limitations'],
    evidence_policy: {
      primary_sources_first: true, claim_level_citations: true, counterevidence_required: true,
      labels: ['fact', 'inference', 'assumption', 'unknown'], accessed_at_required: true
    },
    source_preferences: input.source_preferences || [],
    catalog_snapshot: {
      regions: catalogs.regions.map(item => item.id), sectors: catalogs.sectors.map(item => item.id),
      methods: requestedMethods.filter(id => catalogs.methods.some(method => method.id === id))
    }
  };
}

module.exports = { compileRequest };
