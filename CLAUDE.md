# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

`pnpm` is not installed globally — always use `npx pnpm@9` as a prefix.

```bash
# Development (starts api:4000 + web:3000 concurrently via Turborepo)
npx pnpm@9 dev

# Run a single app
npx pnpm@9 --filter @hr-system/api dev
npx pnpm@9 --filter @hr-system/web dev

# Type-check everything
npx pnpm@9 typecheck

# Type-check a single package
npx pnpm@9 --filter @hr-system/api typecheck

# Lint
npx pnpm@9 lint

# Database
npx pnpm@9 db:migrate    # prisma migrate dev (creates migration + applies)
npx pnpm@9 db:generate   # regenerate Prisma client after schema changes
npx pnpm@9 db:studio     # Prisma Studio at localhost:5555
npx pnpm@9 db:seed       # seed offices, departments, leave types, holidays, super admin
npx pnpm@9 db:seed-demo  # seed 15 demo employees with attendance, leave, role logins

# Install a new dependency into a specific workspace
npx pnpm@9 --filter @hr-system/api add <package>
npx pnpm@9 --filter @hr-system/web add <package>

# Local database
docker compose up -d     # starts postgres:5432

# Production process manager
npx pm2 start ecosystem.config.js
npx pm2 logs / status / restart
```

After any change to `prisma/schema.prisma`, always run `db:generate` before starting the API.

## Architecture

### Monorepo layout

```
apps/api/      → Express backend (port 4000)
apps/web/      → Next.js 14 App Router frontend (port 3000)
packages/types → Shared TypeScript enums + interfaces (zero deps)
packages/utils → Pure functions: date, leave calc, tax engine, currency, pagination
prisma/        → Single schema.prisma + migrations + seed scripts
```

`packages/types` has no runtime dependencies — everything else imports from it. Always add new enums and shared interfaces there, never redefine them locally.

### Multi-tenancy: BD vs UK

The `Office` model is the tenancy anchor. Every resource (Employee, LeaveType, PayrollRun, PublicHoliday, etc.) carries an `officeId`. `office.middleware.ts` attaches `req.officeId` from the authenticated user's employee record; `SUPER_ADMIN` bypasses this and can query any office.

Office-specific logic (tax, currency, timezone, leave entitlements) is resolved by `officeCode` in `packages/utils` — never inline BD/UK conditionals anywhere else.

| | Bangladesh (BD) | United Kingdom (UK) |
|---|---|---|
| Currency | BDT | GBP |
| Timezone | Asia/Dhaka (UTC+6) | Europe/London (BST/GMT) |
| Tax | BD Income Tax slabs (FY 2024-25) | UK PAYE + National Insurance |

### Auth flow

Three JWT token types, all signed with keys from `apps/api/src/utils/jwt.ts`:

| Token | TTL | Secret | Purpose |
|---|---|---|---|
| Access token | 15 min | `JWT_SECRET` | Bearer auth on all API requests |
| Refresh token | 7 days | `JWT_REFRESH_SECRET` | httpOnly cookie → `/auth/refresh` |
| Temp token | 5 min | `JWT_SECRET` | Bridges login → 2FA (TOTP) verify step |

Access tokens are stored **in Zustand memory only** (`apps/web/src/store/auth.store.ts`) — never in localStorage. The Axios client in `apps/web/src/lib/api/client.ts` handles silent refresh on 401 with a request queue to prevent parallel refresh races.

### RBAC

`requireRole(...roles)` in `apps/api/src/middleware/rbac.middleware.ts` uses a numeric hierarchy:

```
SUPER_ADMIN(5) > HR_MANAGER(4) > DEPT_HEAD(3) > TEAM_LEAD(2) > EMPLOYEE(1)
```

Passing a role allows that role **and all roles above it**. Use `requireExactRole` when a specific role (not higher) is needed.

### API modules

Located in `apps/api/src/modules/`. Each module follows:
`<name>.routes.ts` → `<name>.controller.ts` → `<name>.service.ts` + `<name>.schemas.ts` (Zod)

Register the router in `apps/api/src/app.ts` under `/api/v1/<name>`.

Current modules: `auth`, `attendance`, `dashboard`, `departments`, `documents`, `employees`, `holidays`, `job-grades`, `leave`, `notifications`, `payroll`, `salary`, `timesheets`

All responses must go through the helpers in `apps/api/src/utils/response.ts` (`sendSuccess`, `sendCreated`, `sendError`, `sendNotFound`, `sendForbidden`). Standard envelope: `{ success: bool, data?, error?, message?, meta? }`.

Middleware ordering in every protected route: `authenticate → officeScope → [requireRole] → [validate] → controller`

### Frontend data layer

- **API client**: `apps/web/src/lib/api/client.ts` — Axios instance with auth interceptors
- **React Query hooks**: `apps/web/src/lib/api/hooks/` — one file per domain (e.g. `useEmployees.ts`, `useLeave.ts`)
- **Zustand stores**: `apps/web/src/store/` — `auth.store.ts`, `notification.store.ts`, `ui.store.ts`
- **Pages** (`apps/web/src/app/`): Auth pages under `(auth)/`, dashboard pages under `(dashboard)/` — attendance, departments, documents, employees, leave, notifications, payroll, salary, settings, timesheets

UI components use Radix UI primitives + Tailwind CSS + `class-variance-authority`. Use `cn()` from `apps/web/src/lib/utils.ts` for conditional class merging.

### Real-time notifications

Notifications are written to the `Notification` table via Prisma. Supabase Realtime broadcasts the INSERT to the frontend — no Socket.io or Redis. The frontend subscribes in `apps/web/src/store/notification.store.ts` using the Supabase browser client (`apps/web/src/lib/supabase.ts`). Enable Realtime on the `notifications` table in the Supabase dashboard before this works.

### File storage

Supabase Storage replaces S3/R2. Buckets: `avatars` (public), `documents` (private), `payslips` (private). Never stream files through the API — generate presigned upload/read URLs using the service role client (`apps/api/src/config/supabase.ts`).

### Tax engine

`packages/utils/src/tax.ts` exports `calculateIncomeTax(annualGross, officeCode, year)`. Routes to `calculateBDTax` or `calculateUKPAYE`. Never inline tax logic in the payroll service — always call this function. Tax slabs are updated here annually.

### Prisma schema notes

- All IDs use `cuid()`.
- `Office.code` is the stable string key ("BD" / "UK") — prefer it over `officeId` in business logic.
- `LeaveType.approvalChain` is a `Json` column storing `[{level: number, role: string}]` — the multi-level approval sequence.
- `Notification` table must have Realtime enabled in Supabase for push to work.
- Schema requires both `DATABASE_URL` (pooled, Supabase) and `DIRECT_URL` (direct, for migrations).

### Environment variables

Validated at startup by Zod in `apps/api/src/config/env.ts` — the API crashes with a clear error on any missing variable.

**API (required):** `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for migrations), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (32+ chars), `JWT_REFRESH_SECRET` (32+ chars)

**API (optional, with defaults):** `NODE_ENV`, `API_PORT` (4000), `WEB_APP_URL` (http://localhost:3000), `JWT_EXPIRES_IN` (15m), `JWT_REFRESH_EXPIRES_IN` (7d)

**Frontend (`NEXT_PUBLIC_` prefix required):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database connection keep-alive

`apps/api/src/index.ts` runs a `SELECT 1` keepalive interval — Supabase's connection pooler drops idle connections after ~5 min.
