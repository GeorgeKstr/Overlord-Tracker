const BASE = 'https://overlord-tracker-api.onrender.com/api'\;
const TOKEN = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';
const headers = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

async function request(path) {
  const res = await fetch(BASE + path, { headers });
  if (!res.ok) throw new Error('GET ' + path + ' -> ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? (data) : (data.items || data);
}

(async () => {
  const projects = await request('/projects');
  const project = projects.find(p => p.key === 'trainer-client-ops');
  if (!project) throw new Error('Project not found');

  const services = await request('/services?projectId=' + project.id);
  const tickets = await request('/tickets?projectId=' + project.id + '&includeSubtickets=true');

  const sMap = Object.fromEntries(services.map(s => [s.id, s.slug]));
  const tMap = Object.fromEntries(tickets.map(t => [t.id, t.title]));

  const topLevel = tickets.filter(t => !t.parentTicketId);
  const sub = tickets.filter(t => !!t.parentTicketId);

  const effortDist = {};
  tickets.forEach(t => {
    if (t.effort) effortDist[t.effort] = (effortDist[t.effort] || 0) + 1;
  });

  const result = {
    project: { id: project.id, key: project.key, name: project.name },
    totals: { topLevel: topLevel.length, subtickets: sub.length },
    coverage: {
      topLevelWithService: topLevel.filter(t => !!t.serviceId).length,
      topLevelWithEffort: topLevel.filter(t => !!t.effort).length,
      subWithService: sub.filter(t => !!t.serviceId).length,
      subWithEffort: sub.filter(t => !!t.effort).length
    },
    effortDistribution: effortDist,
    sampleTopLevel: topLevel.slice(0, 3).map(t => ({ title: t.title, serviceSlug: sMap[t.serviceId] || null, effort: t.effort })),
    sampleSubtickets: sub.slice(0, 3).map(t => ({ title: t.title, serviceSlug: sMap[t.serviceId] || null, effort: t.effort, parentTitle: tMap[t.parentTicketId] }))
  };

  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
