import { PrismaClient } from '@prisma/client';
import "dotenv/config";

const prisma = new PrismaClient();

const SLUGS = ['gateway', 'tasks-service', 'auth-service', 'notifications-service'];

const API_SPECS: Record<string, string> = {
  'gateway': 'openapi: 3.0.0\ninfo:\n  title: Gateway Service\n  version: 1.0.0\npaths:\n  /:\n    get:\n      responses:\n        "200":\n          description: OK',
  'tasks-service': 'openapi: 3.0.0\ninfo:\n  title: Tasks Service\n  version: 1.0.0\npaths:\n  /tasks:\n    get:\n      responses:\n        "200":\n          description: OK',
  'auth-service': 'openapi: 3.0.0\ninfo:\n  title: Auth Service\n  version: 1.0.0\npaths:\n  /login:\n    post:\n      responses:\n        "200":\n          description: OK',
  'notifications-service': 'openapi: 3.0.0\ninfo:\n  title: Notifications Service\n  version: 1.0.0\npaths:\n  /notify:\n    post:\n      responses:\n        "200":\n          description: OK',
};

async function main() {
  let project = await prisma.project.findUnique({
    where: { key: 'todo-list-demo' }
  });

  if (!project) {
    project = await prisma.project.findFirst({
      where: { name: { contains: 'Todo Platform Demo' } }
    });
  }

  if (!project) {
    console.error('Project not found');
    return;
  }

  console.log('Found project: ' + project.name + ' (' + project.id + ')');

  const serviceMap: Record<string, string> = {};

  for (const slug of SLUGS) {
    let service = await prisma.service.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } }
    });

    if (!service) {
      service = await prisma.service.create({
        data: {
          slug,
          name: slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
          projectId: project.id,
          apiSpec: API_SPECS[slug]
        }
      });
      console.log('Created service: ' + slug);
    } else {
      service = await prisma.service.update({
        where: { id: service.id },
        data: { apiSpec: API_SPECS[slug] }
      });
      console.log('Updated service: ' + slug);
    }
    serviceMap[slug] = service.id;
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: project.id,
      parentTicketId: null
    }
  });

  let assignedCount = 0;
  const perServiceCount: Record<string, number> = {
    'gateway': 0,
    'tasks-service': 0,
    'auth-service': 0,
    'notifications-service': 0
  };

  const unassignedTickets = [];

  for (const ticket of tickets) {
    const text = (ticket.title + ' ' + (ticket.description || '')).toLowerCase();
    let targetSlug = null;

    if (/auth|login|token|session|oauth/.test(text)) {
      targetSlug = 'auth-service';
    } else if (/notify|email|webhook/.test(text)) {
      targetSlug = 'notifications-service';
    } else if (/task|todo|list|item/.test(text)) {
      targetSlug = 'tasks-service';
    } else if (/gateway/.test(text)) {
      targetSlug = 'gateway';
    }

    if (targetSlug) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { serviceId: serviceMap[targetSlug] }
      });
      perServiceCount[targetSlug]++;
      assignedCount++;
    } else {
      unassignedTickets.push(ticket);
    }
  }

  // Round-robin for the rest
  for (let i = 0; i < unassignedTickets.length; i++) {
    const ticket = unassignedTickets[i];
    const targetSlug = SLUGS[i % SLUGS.length];
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { serviceId: serviceMap[targetSlug] }
    });
    perServiceCount[targetSlug]++;
    assignedCount++;
  }

  console.log('\nSummary:');
  console.log('Project: ' + project.name + ' (' + project.key + ')');
  console.log('Services Updated/Ensured: ' + SLUGS.length);
  console.log('Tickets Assigned: ' + assignedCount);
  console.log('Per-service ticket counts:');
  for (const slug of SLUGS) {
    console.log('  - ' + slug + ': ' + perServiceCount[slug]);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
