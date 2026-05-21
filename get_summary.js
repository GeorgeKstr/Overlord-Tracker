const base = 'https://overlord-tracker-api.onrender.com/api'\;
const token = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';

async function request(path) {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

async function run() {
  try {
    const projects = await request('/projects?q=trainer-client-platform');
    const project = projects.find(p => p.key === 'trainer-client-platform');
    if (!project) {
      console.log(JSON.stringify({ error: 'not found' }));
      process.exit(1);
    }

    const services = await request(`/services?projectId=${project.id}`);
    const tickets = await request(`/tickets?projectId=${project.id}&includeSubtickets=true`);
    
    const contextRes = await fetch(`${base}/projects/${project.id}/context`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const context = await contextRes.json();

    const topLevelTickets = tickets.filter(t => !t.parentTicketId);
    const subTickets = tickets.filter(t => t.parentTicketId);

    const subTicketStatusCounts = subTickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    const noBracketEffortPrefixes = tickets.every(t => !/^\[(EPIC|MINOR|NORMAL|MAJOR)\]/.test(t.title));

    const result = {
      project: { id: project.id, key: project.key, name: project.name },
      serviceCount: services.length,
      first3ServiceSlugs: services.slice(0, 3).map(s => s.slug),
      topLevelTicketCount: topLevelTickets.length,
      subTicketCount: subTickets.length,
      subTicketStatusCounts,
      sampleTopLevelTitles: topLevelTickets.slice(0, 5).map(t => t.title),
      sampleSubTicketTitles: subTickets.slice(0, 5).map(t => t.title),
      hasServiceApiSpecsInContext: (context.services || []).length > 0 && context.services.every(s => s.apiSpec),
      first3ServiceEndpointCountsFromContext: (context.services || []).slice(0, 3).map(s => {
        try {
          const spec = JSON.parse(s.apiSpec);
          return Object.keys(spec.paths || {}).length;
        } catch(e) { return 0; }
      }),
      noBracketEffortPrefixes
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
    const subTickets = tickets.filter(t => t.parentTicketId);
    const subTicketStatusCounts = subTickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    const noBracketEffortPrefixes = tickets.every(t => -lc\[(EPIC|MINOR|NORMAL|MAJOR)\]/.test(t.title));
    const result = {
      project: { id: project.id, key: project.key, name: project.name },
      serviceCount: services.length,
      first3ServiceSlugs: services.slice(0, 3).map(s => s.slug),
      topLevelTicketCount: topLevelTickets.length,
      subTicketCount: subTickets.length,
      subTicketStatusCounts,
      sampleTopLevelTitles: topLevelTickets.slice(0, 5).map(t => t.title),
      sampleSubTicketTitles: subTickets.slice(0, 5).map(t => t.title),
      hasServiceApiSpecsInContext: (context.services || []).length > 0 && context.services.every(s => s.apiSpec),
      first3ServiceEndpointCountsFromContext: (context.services || []).slice(0, 3).map(s => {
        try {
          const spec = JSON.parse(s.apiSpec);
          return Object.keys(spec.paths || {}).length;
        } catch(e) { return 0; }
      }),
      noBracketEffortPrefixes
    };
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
