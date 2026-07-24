const NO_SECRET_CONNECTORS = new Set(['world_bank', 'eurostat', 'crossref', 'github_public']);

async function readJson(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(`upstream ${response.status}: ${text.slice(0, 220)}`);
  try { return JSON.parse(text); } catch { throw new Error('upstream returned non-JSON content'); }
}

async function executeConnector(id, params = {}) {
  if (!NO_SECRET_CONNECTORS.has(id)) throw new Error('This connector is not available through the built-in no-secret adapter. See its connector state.');
  let url;
  if (id === 'world_bank') {
    const country = encodeURIComponent(params.country || 'WLD');
    const indicator = encodeURIComponent(params.indicator || 'NY.GDP.MKTP.CD');
    const date = params.start && params.end ? `&date=${encodeURIComponent(params.start)}:${encodeURIComponent(params.end)}` : '';
    url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=200${date}`;
  } else if (id === 'eurostat') {
    const dataset = encodeURIComponent(params.dataset || 'nama_10_gdp');
    const query = new URLSearchParams({ lang: params.lang || 'en' });
    for (const [key, value] of Object.entries(params.filters || {})) query.append(key, String(value));
    url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?${query}`;
  } else if (id === 'crossref') {
    const query = encodeURIComponent(params.query || 'technology foresight');
    const rows = Math.min(Number(params.rows) || 10, 50);
    url = `https://api.crossref.org/works?query=${query}&rows=${rows}&select=DOI,title,author,published,URL,type`;
  } else if (id === 'github_public') {
    const query = encodeURIComponent(params.query || 'foresight forecasting');
    const limit = Math.min(Number(params.limit) || 10, 30);
    url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`;
  }
  const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Decision-Intelligence-Workbench/0.1' }, signal: AbortSignal.timeout(20000) });
  return { connector_id: id, fetched_at: new Date().toISOString(), source_url: url, data: await readJson(response) };
}

module.exports = { executeConnector, NO_SECRET_CONNECTORS };
