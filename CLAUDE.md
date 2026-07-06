# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Last updated: 2026-07-06 — the 4-milestone security/completeness roadmap below is fully shipped. Keep this section current — see "Keeping this section current" below.

**Done (production-quality, wired end-to-end):** Auth (login, TOTP 2FA, session management, JWT refresh, HR-relay password reset), Employees (CRUD, profile sub-resources, avatar, bank info, soft-delete), Departments (CRUD, org tree, manager assignment), Attendance (check-in/out, calendar, late-excuse workflow, bulk import, BD/UK shifts), Leave (multi-level approval lifecycle, balances, cancel-request flow, office-scoped reads, audited approvals), Payroll (run lifecycle, BD/UK tax engine — corrected multi-band UK PAYE calc, payslips, cross-office run creation for SUPER_ADMIN, audited state changes), Salary (structures, office-scoped reads, audited creation), Documents (Supabase signed URLs, soft delete, upload type validation), Company (office profile, compliance docs, upload type validation), Approvals (consolidated history view), Notifications (list page, mark-as-read, Supabase Realtime + polling fallback), Dashboard, Contact Book.

**Shipped this roadmap (Milestones 1-4):**
- BD/UK tenant-isolation fixes: create endpoints no longer trust a client-supplied `officeId`; leave/salary single-resource reads are office-scoped.
- File-upload MIME-type validation added to avatars, documents, certifications/identification, and company logo/compliance docs (`apps/api/src/utils/upload.ts`).
- `SUPER_ADMIN` can now create a `PayrollRun` for either office.
- Password reset: HR generates a one-time link from an employee's profile (`POST /employees/:id/reset-password`); the employee sets a new password at `/reset-password?token=...`. No email delivery exists, so this is HR-relay only — `/forgot-password` just points users to contact HR.
- Timesheets removed entirely (see below).
- Notifications frontend built: `useNotifications.ts` hooks, `/notifications` page, `NotificationRealtimeProvider` (Supabase Realtime, falls back to polling via `useUnreadCount`'s `refetchInterval`).
- **Fixed a real UK PAYE bug** found while writing tests: `calculateSlabTax` in `packages/utils/src/tax.ts` was tracking remaining income by each slab's upper bound instead of the amount actually taxed, which truncated the basic-rate band and skipped higher bands entirely for anyone crossing more than one tax boundary (roughly £50k+ gross) — undercharging tax. Fixed to match the same incremental pattern the BD calculation already used correctly. Regression-tested in `tax.test.ts`. Any UK payroll runs processed before this fix for employees above that threshold should be reviewed.
- Audit logging extended to leave approve/reject/cancel/cancel-approve/cancel-reject, payroll process/approve/mark-paid, and salary structure creation (`writeAudit`/`auditFromRequest`, previously only wired into `employees`/`departments`).
- Test scaffolding added: Vitest in `packages/utils` (tax/leave-calculator/attendance, 30 tests) and `apps/api` (Prisma-mocked supertest tenant-isolation regression suite, 4 tests) — `npx pnpm@9 test` now runs real tests instead of a no-op.
- Cleanup: removed dead `/leave/apply` redirect stub, orphaned `/leave/approvals` duplicate page, and unused `useLeaveCalendar` hook.

**Remaining known gaps (not part of this roadmap):**
- No test coverage beyond the packages/scenarios above — most of `apps/api`'s business logic and all of `apps/web` remain untested.
- No CI pipeline runs `test`/`typecheck`/`lint` automatically (all commands work locally, nothing wired to run on push/PR yet).

**Intentionally removed:** Timesheets (`apps/api/src/modules/timesheets/`, `Timesheet`/`TimesheetEntry` models, `useTimesheets.ts`, `TimesheetStatus` enum) was fully built but never adopted by the frontend and duplicated Time Management (attendance-based). Decommissioned rather than finished — do not reintroduce without an explicit product decision.

**Deferred, no code exists yet (do not build without an explicit ask):** Onboarding (schema-only `OnboardingTask` stub), Announcements, Performance Reviews, Recruitment/ATS, Asset Management, Mobile app.

**Keeping this section current:** after implementing or completing a feature (or removing one), update this section — status lists, the gaps list, and the "Last updated" date — before ending the task. This file is the fastest way for a future session to know what's real vs. planned; let it drift and it becomes actively misleading.

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

# Run tests (Vitest — packages/utils and apps/api only, see Project status)
npx pnpm@9 test
npx pnpm@9 --filter @hr-system/utils test
npx pnpm@9 --filter @hr-system/api test

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

Every refresh token maps 1:1 to a `Session` row (device info, IP, `isValid`, `expiresAt`, `lastUsedAt`). `POST /auth/login` creates a session directly unless the user has `isTwoFactorEnabled`, in which case it returns a temp token instead and the session is only created after `POST /auth/2fa/verify` succeeds. Users manage their own active sessions via `GET /auth/sessions` / `DELETE /auth/sessions/:id` (`auth.service.ts`); TOTP secrets and enable/disable live behind `/auth/2fa/setup|enable|disable`, all `authenticate`-gated (not part of the login bridge).

### RBAC

`requireRole(...roles)` in `apps/api/src/middleware/rbac.middleware.ts` uses a numeric hierarchy:

```
SUPER_ADMIN(5) > HR_MANAGER(4) > DEPT_HEAD(3) > TEAM_LEAD(2) > EMPLOYEE(1)
```

Passing a role allows that role **and all roles above it**. Use `requireExactRole` when a specific role (not higher) is needed. Use `selfOrRole(paramName, ...roles)` for routes where an employee should be able to act on their own record even without the listed role (e.g. uploading their own avatar or editing their own profile sub-resources) — it passes if `req.params[paramName]` matches the caller's `employeeId` OR they hold one of `roles`+. `isSelfOrRole(user, targetEmployeeId, ...roles)` is the same check as a plain predicate, for use inside controllers/services when the target id isn't a route param (e.g. resolved from a DB row or a multipart body).

### API modules

Located in `apps/api/src/modules/`. Each module follows:
`<name>.routes.ts` → `<name>.controller.ts` → `<name>.service.ts` + `<name>.schemas.ts` (Zod)

Register the router in `apps/api/src/app.ts` under `/api/v1/<name>`.

Current modules: `approvals`, `auth`, `attendance`, `company`, `dashboard`, `departments`, `documents`, `employees`, `holidays`, `job-grades`, `leave`, `notifications`, `payroll`, `salary`

`approvals` is read-only: it aggregates cross-module history (leave approvals, attendance late-excuse review) into one unified, sorted timeline for the `/approvals` page — it owns no Prisma models of its own. `company` manages office profile fields (name/address/logo) and compliance document uploads, both Super-Admin-gated.

`employees` is split across three controller/service pairs sharing one router (`employees.routes.ts`): `employees.*` (core CRUD, directory, org chart, bank info), `profile.*` (work experience, education, skills, certifications, identification — each a small sub-resource CRUD keyed by `:id/<resource>/:subId`), and `avatar.controller.ts` (single-file avatar upload). Certification/identification uploads call `documents.service.ts`'s `uploadDocument` directly in-process (not over HTTP) so those files also show up as `Document` rows.

All responses must go through the helpers in `apps/api/src/utils/response.ts` (`sendSuccess`, `sendCreated`, `sendError`, `sendNotFound`, `sendForbidden`). Standard envelope: `{ success: bool, data?, error?, message?, meta? }`.

Middleware ordering in every protected route: `authenticate → officeScope → [requireRole] → [validate] → controller`

### Frontend data layer

- **API client**: `apps/web/src/lib/api/client.ts` — Axios instance with auth interceptors
- **React Query hooks**: `apps/web/src/lib/api/hooks/` — one file per domain (e.g. `useEmployees.ts`, `useLeave.ts`)
- **Zustand stores**: `apps/web/src/store/` — `auth.store.ts`, `notification.store.ts`, `ui.store.ts`
- **Pages** (`apps/web/src/app/`): Auth pages under `(auth)/`, dashboard pages under `(dashboard)/` — approvals, attendance, departments, documents, employees, leave, notifications, payroll, salary, settings, timemanagement (attendance record management/export, not timesheets — there is no timesheets feature, see Project status)

UI components use Radix UI primitives + Tailwind CSS + `class-variance-authority`. Use `cn()` from `apps/web/src/lib/utils.ts` for conditional class merging.

### Real-time notifications

Notifications are written to the `Notification` table via Prisma. The intended design: Supabase Realtime broadcasts the INSERT to the frontend — no Socket.io or Redis — with the frontend subscribing via the Supabase browser client (`apps/web/src/lib/supabase.ts`) and feeding `apps/web/src/store/notification.store.ts`. As of this writing that subscription is not yet implemented (see Project status) — the store exists but nothing populates it. Enable Realtime on the `notifications` table in the Supabase dashboard before wiring this up.

### File storage

Supabase Storage replaces S3/R2. Buckets: `avatars` (public), `documents` (private), `payslips` (private). Never stream files through the API — generate presigned upload/read URLs using the service role client (`apps/api/src/config/supabase.ts`).

### Tax engine

`packages/utils/src/tax.ts` exports `calculateIncomeTax(annualGross, officeCode, year)`. Routes to `calculateBDTax` or `calculateUKPAYE`. Never inline tax logic in the payroll service — always call this function. Tax slabs are updated here annually.

### Prisma schema notes

- All IDs use `cuid()`.
- `Office.code` is the stable string key ("BD" / "UK") — prefer it over `officeId` in business logic.
- `LeaveType.approvalChain` is a `Json` column storing `[{level: number, role: string}]` — the multi-level approval sequence.
- `Notification` table must have Realtime enabled in Supabase for push to work.
- `Session` rows back refresh tokens 1:1 (see Auth flow); `User.isTwoFactorEnabled`/`twoFactorSecret` gate the 2FA step.
- Schema requires both `DATABASE_URL` (pooled, Supabase) and `DIRECT_URL` (direct, for migrations).

### Environment variables

Validated at startup by Zod in `apps/api/src/config/env.ts` — the API crashes with a clear error on any missing variable.

**API (required):** `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for migrations), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (32+ chars), `JWT_REFRESH_SECRET` (32+ chars)

**API (optional, with defaults):** `NODE_ENV`, `API_PORT` (4000), `WEB_APP_URL` (http://localhost:3000), `JWT_EXPIRES_IN` (15m), `JWT_REFRESH_EXPIRES_IN` (7d)

**Frontend (`NEXT_PUBLIC_` prefix required):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database connection keep-alive

`apps/api/src/index.ts` runs a `SELECT 1` keepalive interval — Supabase's connection pooler drops idle connections after ~5 min.
