const test = require('node:test');
const assert = require('node:assert/strict');
const { readManifest, routeMcpServers } = require('../lib/mcp-client.cjs');

test('MCP router chooses verified evidence-domain servers for Japanese requests', () => {
  const routes = routeMcpServers('日本と欧州の不動産、人口、物価、移民、外国投資、資本フロー');
  const ids = routes.map(item => item.id);
  assert.ok(ids.includes('japan_gov_mcp'));
  assert.ok(ids.includes('world_bank_data360_mcp'));
  assert.ok(ids.includes('imf_data_mcp'));
  assert.ok(ids.includes('data_gouv_fr_mcp'));
  assert.ok(routes.every(item => item.state === 'verified' && item.usable));
});

test('MCP router never promotes a degraded server', () => {
  const routes = routeMcpServers('SEC EDGAR 10-K 米国企業開示');
  assert.equal(routes.some(item => item.id === 'sec_edgar_mcp'), false);
  assert.equal(readManifest().servers.find(item => item.id === 'sec_edgar_mcp').state, 'degraded');
});

test('MCP router requires a semantic match', () => {
  assert.deepEqual(routeMcpServers('まったく関係のない文字列'), []);
});
