# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Last updated: 2026-07-14 — the 4-milestone security/completeness roadmap below is fully shipped, plus the additions listed under "Shipped after Milestones 1-4". Keep this section current — see "Keeping this section current" below.

**Done (production-quality, wired end-to-end):** Auth (login, TOTP 2FA, session management, JWT refresh, HR-relay password reset), Employees (CRUD, profile sub-resources, avatar, bank info, soft-delete, SUPER_ADMIN role management), Departments (CRUD, org tree, manager assignment), Attendance (check-in/out, calendar, late-excuse workflow, bulk import, BD/UK shifts, employee-initiated adjustment requests with manager approval), Leave (multi-level approval lifecycle, balances, cancel-request flow, office-scoped reads, audited approvals), Payroll (run lifecycle, BD/UK tax engine — corrected multi-band UK PAYE calc, payslips, cross-office run creation for SUPER_ADMIN, audited state changes), Salary (structures, office-scoped reads, audited creation), Documents (Supabase signed URLs, soft delete, upload type validation), Company (office profile, compliance docs, upload type validation), Approvals (consolidated history view including attendance adjustments), Notifications (list page, mark-as-read, Supabase Realtime + polling fallback), Dashboard, Contact Book, Settings (Profile, Security, Appearance theme picker, SUPER_ADMIN Roles & Permissions).

**Shipped after Milestones 1-4:**
- **Appearance settings tab** (`/settings/appearance`, open to every role): a 14-variant theme picker (7 light — Light/Forest/Ocean/Ice Age/Desert/Autumn/Blossom, 7 dark — Dark/Midnight/AMOLED/Mocha/Slate/Dracula/Monochrome). Replaced the previous minimal `next-themes` light/dark toggle with a small hand-rolled provider (`apps/web/src/components/theme/theme-provider.tsx`, constants/helpers in `apps/web/src/lib/theme.ts`) because driving two independent DOM attributes (a literal `.dark` class for existing Tailwind `dark:` utilities, plus a separate `data-theme="<variant>"` for accent-palette CSS overrides in `globals.css`) isn't expressible via `next-themes`' single `attribute` prop. `next-themes` fully removed from `apps/web/package.json`. The Topbar `ThemeToggle` icon now flips only between the two defaults (`light`/`dark`); picking a named variant is Settings-tab-only.
- **Per-user theme persistence**: theme choice is saved to `User.theme` (new column, default `'light'`) via `PATCH /auth/theme`, not just `localStorage` — it now follows the account across browsers/devices. `AuthUser` (returned by login and `GET /auth/me`) carries `theme`; the shared `Theme`/`THEME_VALUES` type lives in `packages/types` (`enums.ts`) so both the Zod validator (`auth.schemas.ts`) and the frontend swatch list stay in sync off one source of truth. `ThemeProvider` still applies `localStorage` immediately on mount (fast, no flash, and the only option on unauthenticated pages like `/login`), then overwrites it with the account's saved theme once session bootstrap resolves; picking a new swatch while logged in updates local state + fires a fire-and-forget `PATCH /auth/theme` (mirrors the `notification.service.ts` fire-and-forget convention — a failed save doesn't block the UI).
- **Attendance adjustment requests**: employees can request a check-in/check-out correction (or add one for a day with no record at all) from Time Management, with a reason; routes to their real manager via `Employee.reportingToId` → `Department.managerId` → any `HR_MANAGER` fallback (`apps/api/src/services/approver-resolution.service.ts`); manager approves/rejects from a new Approvals tab; approval recomputes status/hours via the existing `computeAttendanceStatus`, tags the record `source: MANUAL`, and notifies both sides (falls back to notifying every `HR_MANAGER` in the office if no specific approver resolves, so a request never goes unnoticed).
- **Fixed a real UTC/local-timezone bug**: `dateToMinutes` in `packages/utils/src/attendance.ts` read check-in/check-out via local `getHours()`/`getMinutes()`, but every check-in/check-out in this app is stored and labelled as UTC — on any machine whose system timezone isn't UTC+0, late/early/overtime calculations silently drifted by that offset. Also affected `manualEntry`/`bulkImport`, which additionally never resolved the employee's actual office shift at all (always defaulted to UK hours regardless of BD/UK). All three now correctly UTC-anchor and office-resolve; five frontend display helpers that rendered times via the viewer's browser timezone instead of UTC were fixed the same way.
- **Roles & Permissions Settings tab** (SUPER_ADMIN-only, `/settings/roles`): a static reference matrix of what each of the 5 roles can do, plus a searchable people list with a role-change action (`PATCH /employees/:id/role`) guarded against self-role-change and demoting the last active `SUPER_ADMIN`.
- Fixed `/payroll/[id]` using the Next.js 15 async-`params` convention (`use(params)`) on this Next.js 14 app — switched to `useParams()`.
- **Design spec written but NOT yet implemented**: `docs/superpowers/specs/2026-07-13-role-management-scoping-design.md` — routes leave-approval/attendance-excuse-review/salary-read authorization to the real reporting chain instead of hierarchy-only checks, plus an implementation plan at `docs/superpowers/plans/2026-07-13-role-management-scoping.md`. Execution was started (subagent-driven-development) but paused before any task completed — treat as not-done until a session actually executes it.

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

Cross-module logic that doesn't belong to a single module lives in `apps/api/src/services/`, not inside a module: `storage.service.ts` (Supabase signed URLs, used by `documents`), `notification.service.ts` (used by `attendance`, `leave`, `payroll` to write `Notification` rows), `twofa.service.ts` (used by `auth`).

### Frontend data layer

- **API client**: `apps/web/src/lib/api/client.ts` — Axios instance with auth interceptors
- **React Query hooks**: `apps/web/src/lib/api/hooks/` — one file per domain (e.g. `useEmployees.ts`, `useLeave.ts`)
- **Zustand stores**: `apps/web/src/store/` — `auth.store.ts`, `notification.store.ts`, `ui.store.ts`
- **Pages** (`apps/web/src/app/`): Auth pages under `(auth)/` (login, 2fa, forgot-password, reset-password), dashboard pages under `(dashboard)/` — approvals, attendance, contact-book, departments, employees, leave, notifications, payroll, salary, settings, timemanagement (attendance record management/export, not timesheets — there is no timesheets feature, see Project status). There is no standalone `documents` page — document upload/listing is a sub-resource of the employees and company pages.

UI components use Radix UI primitives + Tailwind CSS + `class-variance-authority`. Use `cn()` from `apps/web/src/lib/utils.ts` for conditional class merging.

### Real-time notifications

Notifications are written to the `Notification` table via Prisma. The intended design: Supabase Realtime broadcasts the INSERT to the frontend — no Socket.io or Redis — with the frontend subscribing via the Supabase browser client (`apps/web/src/lib/supabase.ts`) and feeding `apps/web/src/store/notification.store.ts`. As of this writing that subscription is not yet implemented (see Project status) — the store exists but nothing populates it. Enable Realtime on the `notifications` table in the Supabase dashboard before wiring this up.

### File storage

Supabase Storage replaces S3/R2. Buckets: `avatars` (public), `documents` (private), `payslips` (private). Never stream files through the API — generate presigned upload/read URLs via `createSignedUploadUrl`/`createSignedReadUrl` in `apps/api/src/services/storage.service.ts`, which wraps the service role client (`apps/api/src/config/supabase.ts`).

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
