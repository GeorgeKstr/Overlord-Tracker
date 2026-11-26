# Overlord Tracker

An internal **platform control plane** — a single dashboard for managing projects, tickets, services, and API metadata across an engineering organization. Google-authenticated, with a live service registry and API spec ingestion.

## What it does

- **Project & ticket tracking** — projects → tickets → subtickets, with labels, comments, and attachments. Admin-managed user accounts (pending approvals).
- **Service registry** — register every deployed service, then poll its health endpoint for live status monitoring.
- **API ingestion** — registered services POST their controller/endpoint metadata (`POST /api/ingestion/controllers`), giving the platform a live, queryable registry of every API across the organization. Ingestion events are logged per project.
- **Google-authenticated** — Auth.js (NextAuth) Google OAuth in the dashboard; the NestJS API validates the same JWTs (Passport JWT strategy). Personal access tokens supported for machine access.
- **Health checking** — a health dashboard page aggregates registered-service status; the API itself exposes `/health`.

## Architecture

pnpm + Turborepo monorepo:

```
apps/
  api/          NestJS 10 REST API — modular (one module per domain),
                Prisma 5, Passport JWT, OpenAPI/Swagger at /docs
  dashboard/    Next.js 14 App Router — Auth.js Google OAuth,
                TanStack Query v5, TailwindCSS + shadcn/ui, Zod
packages/
  database/     Prisma schema + client (PostgreSQL)
  shared-types/ Shared TypeScript types
  config/       Shared tsconfig presets
```

### API modules

| Module | Responsibility |
| --- | --- |
| auth | JWT validation, session management |
| users | User profile reads |
| projects | Project CRUD |
| tickets | Ticket + subticket CRUD |
| comments | Comments on tickets |
| labels | Label management per project |
| services | Service registry CRUD |
| api-ingestion | Ingest controller/endpoint metadata |
| attachments | File attachments |
| analytics | Usage analytics |
| health | System health checks |
| admin | User approvals & administration |
| email | Transactional email |

### Auth flow

1. User signs in via Google OAuth (Auth.js in the dashboard).
2. Auth.js issues an HS256 JWT stored in a cookie.
3. API calls fetch the raw JWT via `/api/auth/token`; the NestJS API validates it with Passport.
4. Machine clients use Personal Access Tokens instead of Google OAuth.

## Getting started

Requirements: Node ≥ 20, pnpm ≥ 9, PostgreSQL.

```bash
pnpm install
pnpm db:push       # apply Prisma schema (packages/database/prisma/schema.prisma)
pnpm dev           # turbo run dev — API on :3001, dashboard on :3000
```

Copy the env templates first: `apps/api/.env.example`, `apps/dashboard/.env.example` (database URL, NextAuth/JWT secrets, Google OAuth credentials).

Scripts: `pnpm build`, `pnpm lint`, `pnpm type-check`, `pnpm db:studio`, `pnpm db:migrate`.

## Deployment

Each app ships a Dockerfile + `railway.toml` for Railway, and `infra/docker-compose.yml` runs the stack locally.

## Docs

More detail in [`docs/`](docs/): [`architecture.md`](docs/architecture.md), [`vision.md`](docs/vision.md), [`api-ingestion.md`](docs/api-ingestion.md), [`roadmap.md`](docs/roadmap.md).
