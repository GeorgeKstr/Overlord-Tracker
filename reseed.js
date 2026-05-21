const PAT = "ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4";
const BASE_URL = "https://overlord-tracker-api.onrender.com/api"\;

const request = async (method, path, body = null) => {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${PAT}`,
      "Content-Type": "application/json"
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  if (res.status >= 400) {
    throw new Error(`Failed ${method} ${path}: ${res.status} - ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
};

const normalize = (d) => (Array.isArray(d) ? d : (d && d.items) || []);

async function run() {
  const ps = normalize(await request("GET", "/projects"));
  let deletedCount = 0;
  for (const p of ps) {
    await request("DELETE", `/projects/${p.id}`);
    deletedCount++;
  }

  const project = await request("POST", "/projects", {
    name: "Trainer Client Operations",
    key: "trainer-client-ops",
    description: "Operational platform for trainers and clients covering onboarding, programming, communication, billing, and AI-assisted planning.",
    status: "ACTIVE"
  });

  const slugs = ["identity-access", "ai-workout-engine", "trainer-client-chat", "billing-ledger", "workout-planning-core", "trainer-dashboard-api", "client-dashboard-api", "notification-orchestrator"];
  const services = [];
  for (const slug of slugs) {
    const apiSpec = {
      openapi: "3.1.0",
      info: { title: slug, version: "1.0.0" },
      paths: {
        [`/${slug}/items`]: {
          post: {
            summary: `Create ${slug} item`,
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } } },
            responses: { "201": { description: "Created" } }
          },
          get: {
            summary: `List ${slug} items`,
            responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } }
          }
        }
      }
    };
    services.push(await request("POST", "/services", {
      projectId: project.id,
      name: slug,
      slug,
      apiSpec: JSON.stringify(apiSpec)
    }));
  }

  const roadmap = "[x] Phase 1: Infrastructure\n[~] Phase 2: Beta Launch\n[ ] Phase 3: Global Scale\n- Milestone: Core Engine\n- Milestone: Billing API";
  const entityGraph = "erDiagram\n  TRAINER ||--o{ CLIENT : manages\n  CLIENT ||--o{ WORKOUT : tracks";
  const readmeMd = "# Trainer Client Ops\nProfessional platform for fitness management.\n## Architecture\nMicroservices approach.\n## Workflow\nTrainer assigns, client tracks.";
  const aggregatedPaths = {};
  services.forEach(s => Object.assign(aggregatedPaths, JSON.parse(s.apiSpec).paths));
  
  await request("PATCH", `/projects/${project.id}/knowledge`, {
    roadmap,
    entityGraph,
    readmeMd,
    apiSpec: JSON.stringify({ openapi: "3.1.0", info: { title: "Combined API", version: "1" }, paths: aggregatedPaths })
  });

  const tlTitles = ["Setup Multi-tenant Auth", "Core Workout Engine", "Real-time Chat Integration", "Subscription Billing Logic", "Client Mobile Experience", "Notification Dispatcher"];
  const topTickets = [];
  for (const title of tlTitles) {
    topTickets.push(await request("POST", "/tickets", { projectId: project.id, title }));
  }

  const subTickets = [];
  for (const parent of topTickets) {
    for (let i = 1; i <= 3; i++) {
        subTickets.push(await request("POST", "/tickets", { projectId: project.id, parentTicketId: parent.id, title: `Phase ${i} implementation for ${parent.title}` }));
    }
  }

  for (let i = 0; i < 6; i++) await request("PATCH", `/tickets/${subTickets[i].id}`, { status: "IN_PROGRESS" });
  for (let i = 6; i < 10; i++) await request("PATCH", `/tickets/${subTickets[i].id}`, { status: "DONE" });

  const notes = ["Refactor db schema", "API authentication fix", "WebSocket heartbeat added", "Billing edge cases handled", "Client UI improved", "Performance audit", "Security scan", "Deployment ready"];
  for (let i = 0; i < 8; i++) await request("POST", `/tickets/${subTickets[i].id}/comments`, { body: notes[i] });

  const allTickets = normalize(await request("GET", `/tickets?projectId=${project.id}`));
  const finalSubTickets = allTickets.filter(t => t.parentTicketId);
  const statusCounts = finalSubTickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  console.log(JSON.stringify({
    project: { id: project.id, key: project.key, name: project.name },
    deletedCount,
    serviceCount: services.length,
    first3ServiceSlugs: slugs.slice(0, 3),
    topLevelTicketCount: topTickets.length,
    subTicketCount: finalSubTickets.length,
    subTicketStatusCounts: statusCounts,
    sampleTopLevelTitles: topTickets.slice(0, 2).map(t => t.title),
    sampleSubTicketTitles: finalSubTickets.slice(0, 2).map(t => t.title),
    noBracketEffortPrefixes: allTickets.every(t => !/^\[.*?\]/.test(t.title)),
    roadmapPreview: roadmap.split("\n")[0],
    readmeLength: readmeMd.length,
    aggregatedApiPathCount: Object.keys(aggregatedPaths).length
  }, null, 2));
}
run().catch(console.error);
