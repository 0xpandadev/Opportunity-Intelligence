const { routeMcpServers } = require('../lib/mcp-client.cjs');

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/route-mcp.cjs <research question>');
  process.exit(2);
}
console.log(JSON.stringify({ query, routes:routeMcpServers(query) }, null, 2));
