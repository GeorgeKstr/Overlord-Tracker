# Architecture

## Overview

The platform uses a monorepo structure with two primary applications and shared packages.

```
platform-control-plane/
├── apps/
│   ├── api/          # NestJS REST API
│   └── dashboard/    # Next.js frontend
├── packages/
│   ├── database/     # Prisma schema + client
│   ├── shared-types/ # Shared TypeScript types
│   └── config/       # Shared tsconfig/eslint
├── docs/
└── infra/
    └── docker-compose.yml
```

## Frontend (apps/dashboard)

- **Framework**: Next.js 14 with App Router
- **Auth**: Auth.js v4 (NextAuth) with Google OAuth
- **State**: TanStack Query v5 for server state
- **UI**: TailwindCSS + shadcn/ui components
- **Validation**: Zod

## Backend (apps/api)

- **Framework**: NestJS 10
- **Architecture**: Modular (one module per domain)
- **Auth**: Passport.js JWT strategy, validated against Auth.js JWTs
- **ORM**: Prisma 5
- **Docs**: OpenAPI/Swagger at `/docs`

### Modules

| Module         | Responsibility                        |
|----------------|---------------------------------------|
| auth           | JWT validation, session management    |
| users          | User profile reads                    |
| projects       | Project CRUD                          |
| tickets        | Ticket + subticket CRUD               |
| comments       | Comment CRUD on tickets               |
| labels         | Label management per project          |
| services       | Service registry CRUD                 |
| api-ingestion  | Ingest controller/endpoint metadata   |
| health         | System health checks                  |
| analytics      | Placeholder for future analytics      |

## Database

PostgreSQL with Prisma ORM. Schema defined in `packages/database/prisma/schema.prisma`.

## Authentication Flow

1. User authenticates via Google OAuth (Auth.js in Next.js)
2. Auth.js issues a standard HS256 JWT stored in a cookie
3. For API calls, the raw JWT is retrieved via `/api/auth/token` route
4. The JWT is sent as `Authorization: Bearer <token>` to NestJS
5. NestJS Passport JWT strategy validates against the same `NEXTAUTH_SECRET`

## API Design

- Base URL: `http://localhost:3001`
- Auth: `Authorization: Bearer <jwt>`
- Format: JSON
- Docs: `/docs` (Swagger UI)
- Prefix: `/api`
