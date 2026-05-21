async function run() {
  const BASE = 'https://overlord-tracker-api.onrender.com/api'\;
  const TOKEN = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';
  const headers = { 'Authorization': 'Bearer ' + TOKEN };

  const prjResp = await fetch(BASE + '/projects', { headers });
  const prjs = await prjResp.json();
  const project = (Array.isArray(prjs) ? prjs : prjs.items).find(p => p.key === 'trainer-client-ops');
  
  if (!project) throw new Error('Project not found');

  const ticResp = await fetch(BASE + '/tickets?projectId=' + project.id + '&includeSubtickets=true', { headers });
  const ticData = await ticResp.json();
  const tickets = Array.isArray(ticData) ? ticData : (ticData.items || []);

  const regex = /^\s*\[(MINOR|NORMAL|EPIC|XS|S|M|L|XL)\]/i;
  const values = [];
  tickets.forEach(t => {
    const m = t.title.match(regex);
    if (m) values.push(m[1].toUpperCase());
  });

  console.log(JSON.stringify({
    totalTickets: tickets.length,
    withEffortCount: values.length,
    effortValues: values
  }, null, 2));
}
run().catch(e => { console.error(e); process.exit(1); });
