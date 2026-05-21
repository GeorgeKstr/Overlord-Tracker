const BASE = "https://overlord-tracker-api.onrender.com/api";
const TOKEN = "ovl_pat_325e1a32e04223da06e7239f87ffde0547c12af645c989a4";
const headers = { Authorization: "Bearer " + TOKEN };

(async () => {
  try {
    const pRes = await fetch(BASE + "/projects", { headers });
    const pData = await pRes.json();
    const items = Array.isArray(pData) ? pData : (pData.items || []);
    const project = items.find(p => p.key === "trainer-client-ops");
    
    if (!project) {
        process.exit(1);
    }

    const cRes = await fetch(BASE + "/projects/" + project.id + "/context", { headers });
    const ctx = await cRes.json();
    const k = ctx.knowledge || {};
    
    console.log(JSON.stringify({
      projectId: project.id,
      key: project.key,
      hasKnowledge: !!ctx.knowledge,
      knowledgeKeys: Object.keys(k),
      hasServiceApiSpecs: (ctx.services || []).some(s => !!s.apiSpec),
      roadmapFirstLine: k.roadmap ? k.roadmap.split("
")[0] : "",
      readmeChars: k.readmeMd ? k.readmeMd.length : 0
    }, null, 2));
  } catch (err) {
    process.exit(1);
  }
})()
