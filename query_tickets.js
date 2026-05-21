const BASE = 'https://overlord-tracker-api.onrender.com/api'\;
const TOKEN = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';
const headers = { Authorization: 'Bearer ' + TOKEN };
async function main() {
  const prjRes = await fetch(BASE + '/projects', { headers });
  const prjs = await prjRes.json();
  const project = (Array.isArray(prjs) ? prjs : prjs.items).find(p => p.key === 'trainer-client-ops');
  if (!project) { console.log('Project not found'); return; }
  
  const ticRes = await fetch(BASE + '/tickets?projectId=' + project.id + '&includeSubtickets=true', { headers });
  const ticData = await ticRes.json();
  const tickets = Array.isArray(ticData) ? ticData : (ticData.items || []);
  
  const effortRegex = /^\s*\[(MINOR|NORMAL|EPIC|XS|S|M|L|XL)\]/i;
  let withEffortCount = 0;
  const effortValues = [];
  
  tickets.forEach(t => {
    const match = t.title.match(effortRegex);
    if (match) {
      withEffortCount++;
      effortValues.push(match[1].toUpperCase());
    }
  });
  
  console.log(JSON.stringify({
    totalTickets: tickets.length,
    withEffortCount,
    effortValues
  }, null, 2));
}
main().catch(err => console.error(err));
