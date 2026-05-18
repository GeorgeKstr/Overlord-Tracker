# Overlord — Agent Workstreams

Task IDs reference `docs/tasks.md`. Work is organized into **waves** (sequential
constraints) and **streams** (independent within a wave — assign to separate agents).

---

## Wave 0 — Unblocks Everything Else

> Must complete before any Wave 1 stream starts. Single agent; fast.

| Stream | Assigned Tasks | Deliverable |
|--------|---------------|-------------|
| **Bootstrap** | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11 | Repo compiles cleanly, DB schema applied, `pnpm build` green |

**Rationale:** Missing config files (`next.config.ts`, `prisma.ts` singleton, `postcss.config.js`,
NextAuth route handler) and the unrun install/migration are blocking dependencies for
every other stream. Nothing else can be verified until this wave is done.

---

## Wave 1 — Parallel Feature Work

> All streams are independent of each other. Assign to separate agents simultaneously.
> Each stream touches a non-overlapping set of files.

---

### Stream 1-A — API Feature Completions
**Agent scope:** `apps/api/src/modules/` only
**Tasks:** B1, B2, B3, B4, B5, B6, B7

```
Files owned:
  apps/api/src/modules/analytics/
  apps/api/src/modules/tickets/  (filtering/pagination additions only)
  apps/api/src/modules/comments/ (PATCH endpoint only)
  apps/api/src/modules/users/    (GET /me alias only)
  apps/api/src/common/dto/pagination.dto.ts  (new)
```

**Completion criteria:**
- `GET /api/analytics` returns real ticket + service + project counts
- `GET /api/tickets` accepts `status`, `priority`, `orderBy`, `cursor`, `take` query params
- All list endpoints return `{ data: T[], nextCursor: string | null, total: number }`

---

### Stream 1-B — API Hardening
**Agent scope:** `apps/api/src/` cross-cutting; `apps/api/package.json`
**Tasks:** C1, C2, C3, C4, C5, C6, C7, C8

```
Files owned:
  apps/api/src/main.ts
  apps/api/src/app.module.ts
  apps/api/src/common/filters/http-exception.filter.ts  (new)
  apps/api/src/common/interceptors/transform.interceptor.ts  (new)
  apps/api/src/modules/health/  (extended)
  apps/api/package.json  (new deps: @nestjs/throttler, @nestjs/terminus, helmet, @nestjs/pino)
```

**Completion criteria:**
- 429 returned after exceeding rate limit in local test
- `/api/health` returns DB + memory status
- Swagger at `/docs` shows complete OpenAPI spec
- All error responses follow `{ statusCode, message, path, timestamp }` shape

---

### Stream 1-C — Dashboard: Missing Pages
**Agent scope:** `apps/dashboard/src/app/(dashboard)/` new pages only
**Tasks:** D1, D2, D3, D4, D5, D6

```
Files owned:
  apps/dashboard/src/app/(dashboard)/tickets/[id]/page.tsx   (new)
  apps/dashboard/src/app/(dashboard)/projects/[id]/labels/page.tsx  (new)
  apps/dashboard/src/app/(dashboard)/projects/[id]/services/[serviceId]/page.tsx  (new)
  apps/dashboard/src/app/(dashboard)/analytics/page.tsx  (new)
  apps/dashboard/src/app/(dashboard)/profile/page.tsx  (new)
  apps/dashboard/src/components/layout/sidebar.tsx  (add nav entries)
```

**Completion criteria:**
- All pages render without runtime errors (use mock data if API stream not complete)
- Ticket detail shows comments, subtickets, labels, and status/priority dropdowns
- Analytics page renders charts or stat cards with real API data
- Sidebar links to all new pages

---

### Stream 1-D — Dashboard: Missing Components
**Agent scope:** `apps/dashboard/src/components/` new files only
**Tasks:** E1, E2, E3, E4, E5, E6, E7, E8, E9, E10

```
Files owned:
  apps/dashboard/src/components/ui/tooltip.tsx       (new)
  apps/dashboard/src/components/ui/scroll-area.tsx   (new)
  apps/dashboard/src/components/ui/popover.tsx       (new)
  apps/dashboard/src/components/tickets/comment-list.tsx  (new)
  apps/dashboard/src/components/tickets/comment-form.tsx  (new)
  apps/dashboard/src/components/labels/label-badge.tsx    (new)
  apps/dashboard/src/components/charts/bar-chart.tsx      (new)
  apps/dashboard/src/components/charts/donut-chart.tsx    (new)
  apps/dashboard/src/app/(dashboard)/projects/[id]/tickets/page.tsx  (edit: add links + label pills)
```

**Note:** This stream can merge with Stream 1-C if only one agent is available —
they are separated here because they write to different directories with zero overlap.

**Completion criteria:**
- All components export correctly and compile with `tsc --noEmit`
- Kanban cards link to `/tickets/[id]` and show label pills

---

### Stream 1-E — Infrastructure & DevOps
**Agent scope:** `infra/`, `packages/database/`, `scripts/`, `apps/*/Dockerfile`
**Tasks:** F1, F2, F3, F4, F5, F6, F7

```
Files owned:
  infra/docker-compose.dev.yml   (new)
  packages/database/prisma/seed.ts  (new)
  scripts/bootstrap.sh           (new)
  apps/api/Dockerfile            (hardening edits)
  apps/dashboard/Dockerfile      (hardening edits)
  apps/api/.dockerignore         (new)
  apps/dashboard/.dockerignore   (new)
  package.json                   (add db:seed script)
```

**Completion criteria:**
- `docker-compose -f infra/docker-compose.dev.yml up` starts Postgres only
- `pnpm db:seed` populates DB with demo data
- `scripts/bootstrap.sh` runs end-to-end without manual steps
- Both Dockerfiles run as non-root user

---

### Stream 1-F — Documentation
**Agent scope:** `README.md`, `docs/` (new files only; `docs/tasks.md` is read-only)
**Tasks:** I1, I2, I3

```
Files owned:
  README.md             (new)
  docs/architecture.md  (new)
  docs/contributing.md  (new)
```

**Completion criteria:**
- `README.md` contains quick-start that works from a fresh clone
- Architecture doc has auth token flow diagram (ASCII or Mermaid)
- Contributing doc explains how to add a new NestJS module end-to-end

---

### Stream 1-G — Security Audit
**Agent scope:** `apps/api/src/main.ts`, `apps/dashboard/src/`, `apps/dashboard/next.config.ts`
**Tasks:** J1, J2, J3, J4, J5, J6

```
Files owned:
  apps/api/src/main.ts                        (CORS hardening)
  apps/dashboard/next.config.ts               (CSP headers)
  apps/dashboard/src/lib/auth.ts              (secret length check, callbackUrl validation)
  .github/workflows/ci.yml                    (audit step — coordinate with Stream 2-A)
```

**Note:** J6 (dependency audit in CI) requires `.github/workflows/ci.yml` to exist —
coordinate with Stream 2-A or add a placeholder step that is filled in by that stream.

**Completion criteria:**
- CORS origin is `DASHBOARD_URL` env var in production; no wildcard
- CSP header present in Next.js responses
- `NEXTAUTH_SECRET` length validated at startup
- `callbackUrl` restricted to same-origin

---

## Wave 2 — Testing (depends on Wave 1)

> Start after Wave 1 streams A, B, C, D are complete and build is green.
> Streams 2-A and 2-B are independent of each other.

---

### Stream 2-A — API Testing
**Agent scope:** `apps/api/src/**/*.spec.ts`, `apps/api/test/`, `apps/api/jest.config.ts`
**Tasks:** G1, G2, G3, G4, G5, G6

```
Files owned:
  apps/api/jest.config.ts              (new)
  apps/api/src/modules/projects/projects.service.spec.ts  (new)
  apps/api/src/modules/tickets/tickets.service.spec.ts    (new)
  apps/api/src/modules/services/services.service.spec.ts  (new)
  apps/api/test/app.e2e-spec.ts        (new — auth, projects CRUD)
```

**Completion criteria:**
- `pnpm --filter @platform/api test` passes with ≥ 80% service-layer coverage
- E2E tests run against a test Postgres database and pass

---

### Stream 2-B — Dashboard Testing
**Agent scope:** `apps/dashboard/src/**/*.test.tsx`, `apps/dashboard/vitest.config.ts`
**Tasks:** G7, G8, G9

```
Files owned:
  apps/dashboard/vitest.config.ts           (new)
  apps/dashboard/src/components/ui/*.test.tsx  (new)
  apps/dashboard/src/app/**/*.test.tsx         (new)
```

**Completion criteria:**
- `pnpm --filter @platform/dashboard test` passes
- Core UI components have smoke tests

---

## Wave 3 — CI/CD (depends on Wave 2)

> Start after test suites are green.

---

### Stream 3-A — CI/CD Pipelines
**Agent scope:** `.github/workflows/`
**Tasks:** H1, H2, H3

```
Files owned:
  .github/workflows/ci.yml      (new)
  .github/workflows/build.yml   (new)
```

**Completion criteria:**
- CI workflow runs on every PR: install → generate → lint → type-check → test
- Build workflow builds and pushes Docker images on merge to `main`
- Turbo remote cache configured for faster CI runs

---

## Dependency Graph (Summary)

```
Wave 0: Bootstrap
    │
    ├─── Wave 1-A: API Features ────────────────────────────┐
    ├─── Wave 1-B: API Hardening ───────────────────────────┤
    ├─── Wave 1-C: Dashboard Pages ─────────────────────────┤
    ├─── Wave 1-D: Dashboard Components ────────────────────┤──► Wave 2-A: API Tests
    ├─── Wave 1-E: Infrastructure ──────────────────────────┤──► Wave 2-B: Dashboard Tests
    ├─── Wave 1-F: Documentation ───────────────────────────┤
    └─── Wave 1-G: Security Audit ──────────────────────────┘
                                                             │
                                                             └──► Wave 3-A: CI/CD
```

**Maximum parallel agents at any time: 7** (one per Wave 1 stream)
**Minimum sequential steps: 3** (Wave 0 → Wave 1 → Wave 2 → Wave 3)
