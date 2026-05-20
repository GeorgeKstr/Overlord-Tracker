import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  index() {
    return {
      _meta: {
        name: 'Overlord Tracker API',
        version: '1.0',
        baseUrl: 'http://localhost:3001',
        docsUi: '/docs',
        health: 'GET /api/health',
      },

      auth: {
        type: 'Bearer JWT (HS256)',
        header: 'Authorization: Bearer <token>',
        obtain: [
          {
            method: 'POST',
            path: '/api/auth/login',
            body: { email: 'string', password: 'string' },
            response: { access_token: 'string' },
            note: 'Use for credential-based login',
          },
          {
            note: 'Google OAuth is handled through the dashboard at /api/auth/token (NextAuth session exchange)',
          },
        ],
        register: {
          method: 'POST',
          path: '/api/auth/register',
          body: { name: 'string', email: 'string', password: 'string' },
          note: 'New accounts start as PENDING and require admin approval',
        },
        me: { method: 'GET', path: '/api/auth/me', response: 'User object' },
        verifyEmail: { method: 'GET', path: '/api/auth/verify-email?token=<email_token>' },
      },

      enums: {
        ticketStatus: ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
        ticketPriority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        ticketEffort: ['MINOR', 'NORMAL', 'EPIC'],
        projectStatus: ['ACTIVE', 'ARCHIVED'],
        userRole: ['USER', 'MODERATOR', 'ADMIN'],
        userStatus: ['PENDING', 'APPROVED', 'REJECTED'],
        memberRole: ['ADMIN', 'MEMBER'],
        knowledgeSections: ['roadmap', 'entityGraph', 'readmeMd', 'apiSpec'],
        ingestMode: ['replace', 'append'],
      },

      endpoints: {
        projects: {
          list: {
            method: 'GET',
            path: '/api/projects',
            auth: true,
            description: 'List all projects the authenticated user has access to',
            response: 'Project[]',
          },
          agentIndex: {
            method: 'GET',
            path: '/api/projects/agent-index',
            auth: true,
            description: 'Compact project list with pre-built API URLs for agent automation',
            response: '{ id, name, key, status, contextUrl, ticketsUrl, knowledgeUrl }[]',
          },
          getOne: {
            method: 'GET',
            path: '/api/projects/:id',
            auth: true,
            params: { id: 'Project CUID' },
            response: 'Project with members and knowledge',
          },
          getByKey: {
            method: 'GET',
            path: '/api/projects/key/:key',
            auth: true,
            params: { key: 'Project short key (e.g. OVR)' },
          },
          create: {
            method: 'POST',
            path: '/api/projects',
            auth: true,
            body: { name: 'string (required)', key: 'string (required, 2-6 uppercase)', description: 'string?', status: 'ACTIVE|ARCHIVED?' },
            response: 'Created Project',
          },
          update: {
            method: 'PATCH',
            path: '/api/projects/:id',
            auth: true,
            body: { name: 'string?', description: 'string?', status: 'ACTIVE|ARCHIVED?' },
          },
          delete: {
            method: 'DELETE',
            path: '/api/projects/:id',
            auth: true,
            note: '204 No Content on success',
          },
          context: {
            method: 'GET',
            path: '/api/projects/:id/context',
            auth: true,
            description: 'Rich project context bundle: project info + knowledge sections + filtered ticket list. Best single call for agent to understand a project.',
            query: {
              status: 'OPEN|IN_PROGRESS|IN_REVIEW|DONE|CANCELLED (optional)',
              priority: 'LOW|MEDIUM|HIGH|CRITICAL (optional)',
              assigneeId: 'User CUID (optional)',
              q: 'Search string in title/description (optional)',
              limit: 'Number 1-200, default 50 (optional)',
            },
            response: '{ project, knowledge: { roadmap, entityGraph, readmeMd, apiSpec }, tickets: Ticket[] }',
          },
          agentUrls: {
            method: 'GET',
            path: '/api/projects/:id/agent-urls',
            auth: true,
            description: 'Returns URL templates for this specific project (tickets, context, knowledge, etc.)',
          },
          members: {
            list: { method: 'GET', path: '/api/projects/:id/members', auth: true },
            add: {
              method: 'POST',
              path: '/api/projects/:id/members',
              auth: true,
              body: { email: 'string (required)', role: 'ADMIN|MEMBER (default: MEMBER)' },
            },
            remove: { method: 'DELETE', path: '/api/projects/:id/members/:memberId', auth: true, note: '204 No Content' },
          },
          knowledge: {
            update: {
              method: 'PATCH',
              path: '/api/projects/:id/knowledge',
              auth: true,
              description: 'Bulk-update any combination of knowledge sections',
              body: { roadmap: 'string?', entityGraph: 'string?', readmeMd: 'string?', apiSpec: 'string?' },
            },
            ingest: {
              method: 'POST',
              path: '/api/projects/:id/knowledge/:section/ingest',
              auth: true,
              params: { section: 'roadmap|entityGraph|readmeMd|apiSpec' },
              body: { content: 'string (required)', mode: 'replace|append (default: replace)', source: 'string?' },
              response: 'Updated knowledge section content',
            },
            history: {
              all: { method: 'GET', path: '/api/projects/:id/knowledge/history', auth: true },
              bySection: { method: 'GET', path: '/api/projects/:id/knowledge/:section/history', auth: true, params: { section: 'roadmap|entityGraph|readmeMd|apiSpec' } },
            },
          },
        },

        tickets: {
          list: {
            method: 'GET',
            path: '/api/tickets',
            auth: true,
            description: 'List tickets. Omit projectId to get all accessible tickets.',
            query: {
              projectId: 'Project CUID (optional — omit for all accessible tickets)',
              status: 'OPEN|IN_PROGRESS|IN_REVIEW|DONE|CANCELLED (optional)',
              priority: 'LOW|MEDIUM|HIGH|CRITICAL (optional)',
              assigneeId: 'User CUID (optional)',
              q: 'Search string (optional)',
              limit: 'Max results (optional)',
            },
            response: 'Ticket[]',
          },
          getOne: {
            method: 'GET',
            path: '/api/tickets/:id',
            auth: true,
            description: 'Get a single ticket including subtickets and comments',
            response: 'Ticket with subtickets[] and comments[]',
          },
          subtickets: {
            method: 'GET',
            path: '/api/tickets/:id/subtickets',
            auth: true,
            response: 'Ticket[] (child tickets only)',
          },
          create: {
            method: 'POST',
            path: '/api/tickets',
            auth: true,
            body: {
              projectId: 'string (required)',
              title: 'string (required)',
              description: 'string?',
              priority: 'LOW|MEDIUM|HIGH|CRITICAL (default: MEDIUM)',
              status: 'OPEN|IN_PROGRESS|IN_REVIEW|DONE|CANCELLED (default: OPEN)',
              assigneeId: 'User CUID?',
              parentTicketId: 'Ticket CUID? (creates a subticket)',
              labelIds: 'string[]?',
              serviceId: 'string?',
              effort: 'MINOR|NORMAL|EPIC?',
              tested: 'boolean?',
              dueDate: 'ISO date string?',
            },
            response: 'Created Ticket',
          },
          update: {
            method: 'PATCH',
            path: '/api/tickets/:id',
            auth: true,
            body: {
              title: 'string?',
              description: 'string?',
              status: 'OPEN|IN_PROGRESS|IN_REVIEW|DONE|CANCELLED?',
              priority: 'LOW|MEDIUM|HIGH|CRITICAL?',
              assigneeId: 'User CUID?',
              labelIds: 'string[]?',
              serviceId: 'string?',
              effort: 'MINOR|NORMAL|EPIC?',
              tested: 'boolean?',
              dueDate: 'ISO date string?',
            },
          },
          delete: {
            method: 'DELETE',
            path: '/api/tickets/:id',
            auth: true,
            note: '204 No Content',
          },
        },

        comments: {
          list: {
            method: 'GET',
            path: '/api/comments',
            auth: true,
            query: { ticketId: 'Ticket CUID (required)' },
            response: 'Comment[]',
          },
          create: {
            method: 'POST',
            path: '/api/comments',
            auth: true,
            body: { ticketId: 'string (required)', body: 'string (required)' },
            response: 'Created Comment',
          },
          update: {
            method: 'PATCH',
            path: '/api/comments/:id',
            auth: true,
            note: 'Own comments only',
            body: { body: 'string (required)' },
          },
          delete: {
            method: 'DELETE',
            path: '/api/comments/:id',
            auth: true,
            note: 'Own comments only. 204 No Content.',
          },
        },

        labels: {
          list: { method: 'GET', path: '/api/labels', auth: true, response: 'Label[]' },
          create: {
            method: 'POST',
            path: '/api/labels',
            auth: true,
            body: { name: 'string (required)', color: 'string? (hex)', projectId: 'string?' },
          },
          delete: { method: 'DELETE', path: '/api/labels/:id', auth: true, note: '204 No Content' },
        },

        services: {
          list: {
            method: 'GET',
            path: '/api/services',
            auth: true,
            query: { projectId: 'Project CUID (required)' },
            response: 'Service[]',
          },
          getOne: { method: 'GET', path: '/api/services/:id', auth: true },
          create: {
            method: 'POST',
            path: '/api/services',
            auth: true,
            body: { name: 'string (required)', projectId: 'string (required)', description: 'string?', repoUrl: 'string?', language: 'string?' },
          },
          update: {
            method: 'PATCH',
            path: '/api/services/:id',
            auth: true,
            body: { name: 'string?', description: 'string?', repoUrl: 'string?', language: 'string?' },
          },
          delete: { method: 'DELETE', path: '/api/services/:id', auth: true, note: '204 No Content' },
        },

        users: {
          list: { method: 'GET', path: '/api/users', auth: true, response: 'User[]' },
          getOne: { method: 'GET', path: '/api/users/:id', auth: true },
          create: {
            method: 'POST',
            path: '/api/users',
            auth: true,
            note: 'Admin only',
            body: { name: 'string', email: 'string', role: 'USER|MODERATOR|ADMIN', status: 'PENDING|APPROVED|REJECTED' },
          },
          update: {
            method: 'PATCH',
            path: '/api/users/:id',
            auth: true,
            body: { name: 'string?', role: 'USER|MODERATOR|ADMIN?', status: 'PENDING|APPROVED|REJECTED?' },
          },
        },

        attachments: {
          listByTicket: { method: 'GET', path: '/api/tickets/:ticketId/attachments', auth: true },
          upload: {
            method: 'POST',
            path: '/api/tickets/:ticketId/attachments',
            auth: true,
            note: 'multipart/form-data with field "file"',
            body: { file: 'image file (multipart)' },
            response: 'Attachment with id and url',
          },
          getOne: {
            method: 'GET',
            path: '/api/attachments/:id',
            auth: true,
            response: 'Attachment including base64 data',
          },
          delete: { method: 'DELETE', path: '/api/attachments/:id', auth: true, note: '204 No Content' },
        },

        ingestion: {
          ingestControllers: {
            method: 'POST',
            path: '/api/ingestion/controllers',
            auth: true,
            description: 'Ingest controller/endpoint metadata for a service (for API documentation automation)',
            body: { serviceId: 'string (required)', controllers: 'object[] (parsed controller metadata)' },
          },
          history: {
            method: 'GET',
            path: '/api/ingestion/history/:serviceId',
            auth: true,
            response: 'IngestionEvent[]',
          },
        },

        analytics: {
          overview: { method: 'GET', path: '/api/analytics', auth: true, note: 'Placeholder — returns stub data' },
        },

        health: {
          check: { method: 'GET', path: '/api/health', auth: false, response: '{ status: "ok" }' },
        },
      },

      agentWorkflow: {
        description: 'Recommended sequence for an autonomous agent managing a project',
        steps: [
          { step: 1, action: 'Discover projects', request: 'GET /api/projects/agent-index', note: 'Returns all accessible projects with pre-built URLs' },
          { step: 2, action: 'Load project context', request: 'GET /api/projects/:id/context?status=OPEN&limit=50', note: 'Returns project info + all knowledge sections + filtered tickets in one call' },
          { step: 3, action: 'Create a ticket', request: 'POST /api/tickets', body: { projectId: '<id>', title: 'string', description: 'string', priority: 'HIGH|MEDIUM|LOW|CRITICAL', status: 'OPEN' } },
          { step: 4, action: 'Update ticket status', request: 'PATCH /api/tickets/:id', body: { status: 'IN_PROGRESS|IN_REVIEW|DONE|CANCELLED' } },
          { step: 5, action: 'Assign a ticket', request: 'PATCH /api/tickets/:id', body: { assigneeId: '<userId>' } },
          { step: 6, action: 'Add a comment', request: 'POST /api/comments', body: { ticketId: '<id>', body: 'Analysis or notes here' } },
          { step: 7, action: 'Update project knowledge', request: 'POST /api/projects/:id/knowledge/roadmap/ingest', body: { content: 'Updated roadmap content', mode: 'replace', source: 'agent' } },
          { step: 8, action: 'Link a service', request: 'POST /api/services', body: { projectId: '<id>', name: 'service-name', repoUrl: 'https://...', language: 'TypeScript' } },
        ],
        tips: [
          'Always fetch /api/projects/agent-index first to get project IDs and pre-built context URLs',
          'Use /api/projects/:id/context with filters to limit tokens — pass status=OPEN to get only actionable tickets',
          'knowledge.entityGraph is best for understanding project structure and dependencies',
          'knowledge.roadmap is best for understanding planned work and priorities',
          'Use parentTicketId when creating sub-tasks to keep work organized',
          'When closing a ticket, set status=DONE; when it needs human review set status=IN_REVIEW',
        ],
      },
    }
  }
}