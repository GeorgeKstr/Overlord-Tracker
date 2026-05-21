const BASE_URL = 'https://overlord-tracker-api.onrender.com/api';
const TOKEN = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';

async function request(path, options = {}) {
  const url = BASE_URL + path;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error('Request failed: ' + response.status + ' ' + body);
    process.exit(1);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function run() {
  const getResults = await request('/projects?q=fitflow-platform');
  const items = Array.isArray(getResults) ? getResults : (getResults.items || []);
  
  const matches = items.filter(p => p.key === 'fitflow-platform' || (p.name && p.name.includes('FitFlow Trainer Platform')));
  const deletedIds = [];
  
  for (const match of matches) {
    await request('/projects/' + match.id, { method: 'DELETE' });
    deletedIds.push(match.id);
  }
  
  const finalResults = await request('/projects?q=fitflow-platform');
  const finalItems = Array.isArray(finalResults) ? finalResults : (finalResults.items || []);
  
  console.log(JSON.stringify{
    beforeCount: items.length,
    deletedIds: deletedIds,
    afterCount: finalItems.length,
    remainingKeys: finalItems.Map(p => p.key)
  }, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
