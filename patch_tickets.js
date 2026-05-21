const BASE = 'https://overlord-tracker-api.onrender.com/api'\;
const TOKEN = 'ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4';
const headers = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = txt; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${txt}`);
  return Array.isArray(data) ? data : (data && data.items ? data.items : data);
}

(async () => {
  try {
    const projects = await request('GET', '/projects');
    const project = projects.find(p => p.key === 'trainer-client-ops');
    if (!project) throw new Error('Project not found');

    const tickets = await request('GET', '/tickets?projectId=' + project.id + '&includeSubtickets=true');
    let subtickets = tickets.filter(t => !!t.parentTicketId);
    subtickets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const patterns = [
      { status: 'DONE', tested: true },
      { status: 'DONE', tested: false },
      { status: 'IN_PROGRESS', tested: false },
      { status: 'IN_REVIEW', tested: false },
      { status: 'OPEN', tested: false },
      { status: 'IN_PROGRESS', tested: true }
    ];

    let updatedCount = 0;
    for (let i = 0; i < subtickets.length; i++) {
      const p = patterns[i % patterns.length];
      const s = subtickets[i];
      if (s.status !== p.status || s.tested !== p.tested) {
        await request('PATCH', '/tickets/' + s.id, p);
        updatedCount++;
      }
    }

    const fresh = await request('GET', '/tickets?projectId=' + project.id + '&includeSubtickets=true');
    const fs = fresh.filter(t => !!t.parentTicketId);
    const combos = {
      done_tested: fs.filter(t => t.status === 'DONE' && t.tested === true).length,
      done_untested: fs.filter(t => t.status === 'DONE' && t.tested === false).length,
      in_progress_tested: fs.filter(t => t.status === 'IN_PROGRESS' && t.tested === true).length,
      in_progress_untested: fs.filter(t => t.status === 'IN_PROGRESS' && t.tested === false).length,
      in_review: fs.filter(t => t.status === 'IN_REVIEW').length,
      open: fs.filter(t => t.status === 'OPEN').length
    };

    console.log(JSON.stringify({
      project: { id: project.id, key: project.key, name: project.name },
      subticketTotal: fs.length,
      combos,
      updatedCount,
      sample: fs.slice(0, 5).map(t => ({ id: t.id, title: t.title, status: t.status, tested: t.tested }))
    }, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
