# Overlord — Master Task List

All work required to bring the platform from its current scaffolded state to a
production-ready, fully-tested deployment.

Tasks are numbered for cross-reference with `agent-workstreams.md`.

---

## Group A — Bootstrapping & Config

Tasks that create missing runtime-required files or finish incomplete scaffolding.

| ID  | Task | Notes |
|-----|------|-------|
| A1  | Create `.gitignore` at repo root | Exclude `.env`, `node_modules`, `.next`, `dist`, `*.log`, `pnpm-lock.yaml` debate |
| A2  | Create `apps/dashboard/next.config.ts` | Enable `output: 'standalone'`, set `images.remotePatterns` for Google avatars, point `experimental.serverComponentsExternalPackages` at `@prisma/client` |
| A3  | Create `apps/dashboard/src/lib/prisma.ts` | Global singleton PrismaClient to avoid multiple connections in Next.js dev |
| A4  | Update `apps/dashboard/src/lib/auth.ts` | Import `prisma` from `./prisma` singleton instead of instantiating inline |
| A5  | Verify `apps/dashboard/src/app/globals.css` | Ensure CSS custom properties (HSL tokens, dark-mode class) are present for Tailwind theme |
| A6  | Create `apps/dashboard/postcss.config.js` | `tailwindcss` + `autoprefixer` plugins |
| A7  | Create `apps/dashboard/src/app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all route handler (required by Auth.js v4 app router) |
| A8  | Run `pnpm install` from workspace root | Fully materialise lockfile with all deps including newly-added `jose` |
| A9  | Run `pnpm db:push` (dev) or `pnpm db:migrate dev --name init` | Apply Prisma schema to the PostgreSQL database |
| A10 | Run `pnpm db:generate` | Regenerate Prisma Client after schema is applied |
| A11 | Verify `pnpm build` succeeds across all workspaces | Catch any remaining compile or bundle errors before adding features |

---

## Group B — API: Feature Completions

Finish thin or stub modules in the NestJS API.

| ID  | Task | Notes |
|-----|------|-------|
| B1  | Implement `AnalyticsService` with real DB queries | Return: tickets by status, services by status, projects count, recent activity feed (last 20 ticket events) |
| B2  | Add `GET /api/analytics` response contract | Typed response DTO; guard with `JwtAuthGuard` |
| B3  | Add filtering + sorting to `GET /api/tickets` | Query params: `status`, `priority`, `assigneeId`, `labelId`, `orderBy`, `order` |
| B4  | Add cursor-based pagination to list endpoints | `PaginatedResponse<T>` wrapper; shared `PaginationDto` with `cursor`, `take`; apply to `/tickets`, `/comments`, `/services` |
| B5  | Add `GET /api/tickets/:id/comments` on the ticket resource | Convenience alias; re-uses CommentsService |
| B6  | Add `PATCH /api/comments/:id` | Allow comment author to edit body |
| B7  | Add `GET /api/users/me` | Alias for `/auth/me` via UsersModule (cleaner REST path) |

---

## Group C — API: Hardening & Observability

Cross-cutting concerns for production readiness.

| ID  | Task | Notes |
|-----|------|-------|
| C1  | Add `@nestjs/throttler` | Rate limit: 100 req / 60 s per IP; apply globally; tighter limit on auth endpoints |
| C2  | Add `helmet` middleware | All security headers (CSP, HSTS, X-Frame-Options, etc.) in `main.ts` |
| C3  | Add `@nestjs/terminus` health check | Extend `/api/health`: add `PrismaHealthIndicator` (DB ping), memory RSS indicator |
| C4  | Add structured logging with `@nestjs/pino` or `winston` | JSON logs in production; include request ID; exclude health-check noise |
| C5  | Add startup env validation | `joi` or `zod` schema in `ConfigModule.forRoot({ validate })` — fail fast on missing secrets |
| C6  | Add global exception filter | Consistent `{ statusCode, message, path, timestamp }` error envelope |
| C7  | Add `class-transformer` response interceptor | Strip `@Exclude()` fields (e.g., internal DB IDs not needed on wire) |
| C8  | Add `@nestjs/swagger` decorators to all DTOs and controllers | Complete OpenAPI spec for the Swagger UI at `/docs` |

---

## Group D — Dashboard: Missing Pages

UI pages that are needed for complete feature parity with the API.

| ID  | Task | Notes |
|-----|------|-------|
| D1  | Create `(dashboard)/tickets/[id]/page.tsx` | Ticket detail: title, description, status/priority selectors, subtickets list, comment thread, assigned labels, parent ticket link |
| D2  | Create `(dashboard)/projects/[id]/labels/page.tsx` | Label CRUD for a project: colour picker, name input, edit, delete |
| D3  | Create `(dashboard)/analytics/page.tsx` | Stats cards + simple bar/donut charts (tickets by status, services by status, recent activity feed) |
| D4  | Create `(dashboard)/profile/page.tsx` | Show name, email, avatar; link to Google account; display active sessions (from `next-auth`) |
| D5  | Add sidebar navigation entries for Analytics and Profile | Update `src/components/layout/sidebar.tsx` |
| D6  | Create `(dashboard)/projects/[id]/services/[serviceId]/page.tsx` | Service detail: edit form, list of ApiControllers + endpoints, trigger re-ingestion button |

---

## Group E — Dashboard: Missing Components

Reusable components referenced by new pages or needed for completeness.

| ID  | Task | Notes |
|-----|------|-------|
| E1  | Create `src/components/ui/tooltip.tsx` | Radix `@radix-ui/react-tooltip` wrapper (already in deps) |
| E2  | Create `src/components/ui/scroll-area.tsx` | Radix `@radix-ui/react-scroll-area` for long lists |
| E3  | Create `src/components/ui/popover.tsx` | Radix `@radix-ui/react-popover` — needed for colour picker and filters |
| E4  | Create `src/components/tickets/comment-list.tsx` | Renders paginated comment list with author avatar + relative time |
| E5  | Create `src/components/tickets/comment-form.tsx` | Textarea + submit; optimistic update via TanStack Query mutation |
| E6  | Create `src/components/labels/label-badge.tsx` | Coloured pill badge; used in ticket detail and kanban cards |
| E7  | Create `src/components/charts/bar-chart.tsx` | Lightweight bar chart using SVG (no extra dep) or `recharts` |
| E8  | Create `src/components/charts/donut-chart.tsx` | Donut/pie chart for status distribution |
| E9  | Add ticket link on kanban cards | Kanban cards in `tickets/page.tsx` should be clickable links to `/tickets/[id]` |
| E10 | Add label pills to kanban cards | Fetch labels per ticket and render `LabelBadge` |

---

## Group F — Infrastructure & DevOps

| ID  | Task | Notes |
|-----|------|-------|
| F1  | Create `infra/docker-compose.dev.yml` | Postgres only; api and dashboard run locally with hot-reload via pnpm dev; bind-mount source code |
| F2  | Create `packages/database/prisma/seed.ts` | Seed: one demo user, one project, 5 tickets (mixed statuses), 2 services (one HEALTHY, one DEGRADED) |
| F3  | Add `db:seed` script to root `package.json` | `ts-node packages/database/prisma/seed.ts` |
| F4  | Create `scripts/bootstrap.sh` | One-command local setup: `pnpm install && cp .env.example .env && pnpm db:push && pnpm db:seed` |
| F5  | Review and harden `apps/api/Dockerfile` | Add `--frozen-lockfile`, `NODE_ENV=production`, non-root user, and health-check `CMD` |
| F6  | Review and harden `apps/dashboard/Dockerfile` | Same: non-root user, `NEXT_TELEMETRY_DISABLED`, verify standalone copy paths |
| F7  | Add `.dockerignore` files to both apps | Exclude `node_modules`, `.next`, `dist`, `.env*` |

---

## Group G — Testing

| ID  | Task | Notes |
|-----|------|-------|
| G1  | Configure Jest in `apps/api` | `jest.config.ts`, `@nestjs/testing`, `ts-jest`; separate unit and e2e test scripts |
| G2  | Write unit tests — `ProjectsService` | CRUD operations; mock `PrismaService` |
| G3  | Write unit tests — `TicketsService` | Include parent-ticket depth validation logic |
| G4  | Write unit tests — `ServicesService` | Status updates, slug uniqueness |
| G5  | Write e2e tests — auth flow (API) | JWT validation, 401 on missing token, `/auth/me` returns correct user |
| G6  | Write e2e tests — projects CRUD (API) | Full happy path + error cases |
| G7  | Configure Vitest + React Testing Library in `apps/dashboard` | `vitest.config.ts`, `@testing-library/react`, `@testing-library/user-event`, jsdom |
| G8  | Write component tests for `Button`, `Dialog`, `Badge` | Smoke tests; ensure variants render |
| G9  | Write component tests for dashboard pages | Mock `api-client`; test loading/empty/populated states |
| G10 | Configure Playwright for E2E | `playwright.config.ts` at root; test login flow, create project, create ticket |

---

## Group H — CI/CD

| ID  | Task | Notes |
|-----|------|-------|
| H1  | Create `.github/workflows/ci.yml` | On push/PR: install, db:generate, lint, type-check, test (unit + e2e with postgres service container) |
| H2  | Create `.github/workflows/build.yml` | On push to `main`: build Docker images, push to registry (GHCR or DockerHub) |
| H3  | Add `turbo` caching to CI | `TURBO_TOKEN` + `TURBO_TEAM` env vars or local filesystem cache |

---

## Group I — Documentation

| ID  | Task | Notes |
|-----|------|-------|
| I1  | Create `README.md` | Overview, prerequisites, quick-start (Docker and local), env-var table, links to Swagger and dashboard |
| I2  | Create `docs/architecture.md` | System diagram, data-flow, auth token flow (Auth.js → raw JWT → NestJS Passport), Prisma monorepo layout |
| I3  | Create `docs/contributing.md` | Branch strategy, commit convention, PR checklist, how to add a new API module |

---

## Group J — Security Audit

| ID  | Task | Notes |
|-----|------|-------|
| J1  | Audit CORS config in `apps/api/src/main.ts` | Allow-list only known origins; do not use `*` in production |
| J2  | Add `Content-Security-Policy` header in Next.js | Via `next.config.ts` headers() or middleware |
| J3  | Ensure no secrets or PII appear in logs | Audit logging calls; redact `Authorization` headers |
| J4  | Add `NEXTAUTH_SECRET` length check at startup | Warn if < 32 chars |
| J5  | Validate `redirect` destinations in login page | Only allow relative or same-origin `callbackUrl` to prevent open redirect |
| J6  | Add OWASP dependency audit step | `pnpm audit` in CI; fail on high-severity CVEs |
