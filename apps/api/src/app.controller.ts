import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  index() {
    return {
      name: 'Platform Control Plane API',
      version: '1.0',
      docs: '/docs',
      health: '/api/health',
      auth: {
        header: 'Authorization: Bearer <JWT_OR_PERSONAL_TOKEN>',
      },
      discovery: {
        projects: '/api/projects',
        agentIndex: '/api/projects/agent-index',
      },
      projectContext: {
        template: '/api/projects/{projectId}/context',
        supportedFilters: ['status', 'priority', 'assigneeId', 'q', 'limit'],
      },
      tickets: {
        template: '/api/tickets?projectId={projectId}',
        supportedFilters: ['status', 'priority', 'assigneeId', 'q', 'limit'],
      },
      knowledge: {
        history: '/api/projects/{projectId}/knowledge/history',
        sectionHistory: '/api/projects/{projectId}/knowledge/{section}/history',
        ingest: {
          roadmap: '/api/projects/{projectId}/knowledge/roadmap/ingest',
          entityGraph: '/api/projects/{projectId}/knowledge/entityGraph/ingest',
          readmeMd: '/api/projects/{projectId}/knowledge/readmeMd/ingest',
          apiSpec: '/api/projects/{projectId}/knowledge/apiSpec/ingest',
        },
      },
    }
  }
}