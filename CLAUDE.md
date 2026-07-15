# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Last updated: 2026-07-15 — the 4-milestone security/completeness roadmap below is fully shipped, plus the additions listed under "Shipped after Milestones 1-4". Keep this section current — see "Keeping this section current" below.

**Done (production-quality, wired end-to-end):** Auth (login, TOTP 2FA, session management, JWT refresh, HR-relay password reset), Employees (CRUD, profile sub-resources, avatar, bank info, soft-delete, SUPER_ADMIN role management), Departments (CRUD, org tree, manager assignment), Attendance (check-in/out, calendar, late-excuse workflow, bulk import, BD/UK shifts, employee-initiated adjustment requests with manager approval), Leave (reporting-chain-based approval lifecycle with dept-head override, balances, cancel-request flow, office-scoped reads, audited approvals), Payroll (run lifecycle, BD/UK tax engine — corrected multi-band UK PAYE calc, payslips, cross-office run creation for SUPER_ADMIN, audited state changes), Salary (structures, office-scoped reads, audited creation), Documents (Supabase signed URLs, soft delete, upload type validation), Company (office profile, compliance docs, upload type validation), Approvals (consolidated history view including attendance adjustments), Notifications (list page, mark-as-read, Supabase Realtime + polling fallback), Announcements (dashboard card + full page, manual posts and automated items), Dashboard, Contact Book, Settings (Profile, Security, Appearance theme picker, SUPER_ADMIN Roles & Permissions).

**Shipped after Milestones 1-4:**
- **Announcements** (`apps/api/src/modules/announcements/`, dashboard card + `/announcements` page): a company-news feed combining real `Announcement` rows (manual posts by SUPER_ADMIN/HR_MANAGER — `GENERAL`/`OFFICE_CLOSURE`/`OTHER` categories, optional attachment via the same multer+`uploadFile()` pattern used for avatars/documents, optional office scope) with automated items computed live on every `GET /announcements/feed` call (new joinee within 7 days, birthday today, work anniversary today, upcoming holiday within 14 days, policy document uploaded within 7 days) — no cron job, no persisted rows for the automated ones, since this app has zero scheduled-job infrastructure and recomputing avoids any de-dup/idempotency problem. `Announcement` gained a `category` column and an `author` relation (was schema-only since an earlier "Phase 3" placeholder). Same tenant-isolation pattern as other create endpoints: HR_MANAGER's `officeId` is forced server-side to their own office regardless of what's in the request body; only SUPER_ADMIN can target a specific office or "all offices" (`officeId: null`). Edit/delete restricted to the original author or SUPER_ADMIN (`isSelfOrRole`).
- **Dashboard card layout** (`EmployeeDashboard.tsx`/`ManagerDashboard.tsx`, not a shared component — `AnnouncementsCard` and the new `RecentApprovalsCard` are placed independently in each): on the employee dashboard, Today's Status (clock/check-in) pairs with My Manager, and Leave Balance pairs with Announcements (`sm:grid-cols-2 lg:grid-cols-4`, one row). On the admin/manager dashboard, Announcements sits beside Compliance & Policy Documents (`lg:grid-cols-2`), positioned above the "Headcount by department" chart. **Recent Approval Requests** (`apps/web/src/components/dashboard/RecentApprovalsCard.tsx`, admin/manager dashboard only, placed right after the stat tiles) merges the same three "pending" queries the `/approvals` page already uses (`usePendingApprovals`/`usePendingExcuses`/`usePendingAdjustments`) client-side, sorts by recency, and shows the latest 5 — each row links to `/approvals?tab=<leave|excuses|adjustments>`. `ApprovalsPage` now reads that `tab` query param (via `useSearchParams`, precedented by `employees/page.tsx`) to pick its initial tab, so the dashboard card deep-links straight to the right queue instead of always landing on "Leave".
- **Appearance settings tab** (`/settings/appearance`, open to every role): a 14-variant theme picker (7 light — Light/Forest/Ocean/Ice Age/Desert/Autumn/Blossom, 7 dark — Dark/Midnight/AMOLED/Mocha/Slate/Dracula/Monochrome). Replaced the previous minimal `next-themes` light/dark toggle with a small hand-rolled provider (`apps/web/src/components/theme/theme-provider.tsx`, constants/helpers in `apps/web/src/lib/theme.ts`) because driving two independent DOM attributes (a literal `.dark` class for existing Tailwind `dark:` utilities, plus a separate `data-theme="<variant>"` for accent-palette CSS overrides in `globals.css`) isn't expressible via `next-themes`' single `attribute` prop. `next-themes` fully removed from `apps/web/package.json`. The Topbar `ThemeToggle` icon now flips only between the two defaults (`light`/`dark`); picking a named variant is Settings-tab-only.
- **Per-user theme persistence**: theme choice is saved to `User.theme` (new column, default `'light'`) via `PATCH /auth/theme`, not just `localStorage` — it now follows the account across browsers/devices. `AuthUser` (returned by login and `GET /auth/me`) carries `theme`; the shared `Theme`/`THEME_VALUES` type lives in `packages/types` (`enums.ts`) so both the Zod validator (`auth.schemas.ts`) and the frontend swatch list stay in sync off one source of truth. `ThemeProvider` still applies `localStorage` immediately on mount (fast, no flash, and the only option on unauthenticated pages like `/login`), then overwrites it with the account's saved theme once session bootstrap resolves; picking a new swatch while logged in updates local state + fires a fire-and-forget `PATCH /auth/theme` (mirrors the `notification.service.ts` fire-and-forget convention — a failed save doesn't block the UI).
- **Theme-switch wave animation**: clicking a swatch (or the Topbar `ThemeToggle`) triggers a circular reveal expanding from the click point via the View Transitions API (`document.startViewTransition` + an animated `clip-path: circle()` on `::view-transition-new(root)`, driven from `ThemeProvider.setTheme`'s optional `origin` param). Ambient typing for the not-yet-in-TS-lib API lives in `apps/web/src/types/view-transitions.d.ts`; the browser's default cross-fade is suppressed in `globals.css` so only the custom circle animates. Falls back to an instant swap (no animation) when the browser lacks `startViewTransition`, `prefers-reduced-motion: reduce` is set, or no click origin is available (e.g. the one-time load-time sync from the account's saved theme). Since `startViewTransition` and animating a pseudo-element via `Element.animate({pseudoElement})` landed in different Chromium versions, `setTheme` force-closes the transition (`transition.skipTransition()`) on any animate() failure or after a 1s safety timeout, so an unsupported combination can never leave the full-viewport transition overlay stuck on top of the page swallowing clicks.
- **Fixed a real check-in time bug**: `selfCheckIn`/`selfCheckOut` (`apps/api/src/modules/attendance/attendance.service.ts`) were storing `new Date()` — the server's true UTC instant — directly as `checkIn`/`checkOut`. Every check-in/check-out in this app is meant to hold the *office's local wall-clock digits* in a Date's UTC slots (see `dateToMinutes` in `packages/utils/src/attendance.ts`, and `BD_SHIFT`/`UK_SHIFT`'s literal "13:30"/"09:00" office-local values), so a true UTC instant only matched whenever the office's real UTC offset happened to be zero — meaning UK check-ins were off by exactly the current BST offset (the reported symptom: "current time 8:30 but check-in shows 7:30"), and BD check-ins (always UTC+6) were wrong by a full 6 hours. Fixed by converting through `toOfficeTime()` (`packages/utils/src/date.ts`) before storing. That helper itself — already in the codebase but never wired up or tested until now — turned out to be silently broken: it wrapped `date-fns-tz@3.1.3`'s `toZonedTime`/`fromZonedTime`, which compute the offset relative to the *host process's own* local timezone rather than true UTC, so they silently applied a zero offset whenever the process's system TZ happened to already match the target office's TZ (this repo's dev machine runs `Europe/London`, so the bug was fully masked for UK during BST and only partially masked for BD). Rewrote both functions using `Intl.DateTimeFormat`'s `timeZone` option directly, verified environment-independent under both `TZ=Europe/London` and `TZ=UTC`; `date-fns-tz` removed from `packages/utils/package.json` entirely. Regression-tested in `packages/utils/src/date.test.ts` and `apps/api/src/modules/attendance/attendance.service.selfCheckIn.test.ts`, and confirmed live against a running BD check-in. The exact same bug (local `setHours` instead of `setUTCHours`) was also found in the demo seed script's `atTime()` helper (`prisma/src/seed-demo.ts`), which had corrupted every seeded historical attendance row's check-in/check-out time the same way — fixed and re-seeded (`npx pnpm@9 db:seed-demo`). That re-seed also surfaced (and fixed) a stale `cleanup()` that predated several newer profile-subresource tables (`Education`, `WorkExperience`, `EmployeeSkill`, `Certification`, `Identification`, `SalaryStructure`, `Announcement`) and didn't null out `Department.managerId`/`Employee.reportingToId` self-references first, so it threw a foreign-key error on every attempt to re-run — now handles all of them, making the script actually re-runnable again as intended.
- **Fixed a real weekend-misalignment bug**: Time Management was showing Friday/Saturday as the weekend and Sunday as a workday (should be Sat/Sun weekend, Mon-Fri workdays). Root cause was `dateOnly()` in `prisma/src/seed-demo.ts` truncating to *local* midnight (`setHours(0,0,0,0)`) instead of UTC midnight — on this repo's dev machine (BST, UTC+1), local midnight for day N serializes as `23:00 UTC` on day N-1, so every seeded attendance row's `date` (a `@db.Date` column, stored via its UTC representation) landed one calendar day early while its `status`/`isWeekend` were computed for the intended day — Saturday's WEEKEND status ended up stored under Friday's date, Sunday's under Saturday's, Monday's PRESENT under Sunday's, and so on. Fixed `dateOnly()`/`addDays()` to use UTC methods throughout (matching the `atTime()` fix above) and re-seeded; verified directly against the DB that every Sat/Sun row now reads `WEEKEND` and every Mon-Fri row reads a real workday status.
- **Native date/time picker fixes**: two real bugs surfaced once the 14-theme palette shipped. (1) The browser was rendering `<input type="date">`/`type="time"` picker icons in a fixed light-mode color regardless of the active theme, making the icon nearly invisible on several dark variants — fixed by setting `color-scheme: light` in `:root` and `color-scheme: dark` in `.dark` (`globals.css`), the standard CSS mechanism for telling the browser which appearance to render native form controls in. (2) Since the native picker only opens when you click the tiny icon (not the rest of the field), `apps/web/src/app/providers.tsx` now has a document-level delegated click listener (`useOpenPickerOnClick`) that calls `showPicker()` on any `date`/`time`/`datetime-local`/`month`/`week` input clicked anywhere in its bounds — verified with a headless-browser repro (Playwright) showing the calendar popup opening from a mid-field click, in both light and dark themes.
- **Attendance adjustment requests**: employees can request a check-in/check-out correction (or add one for a day with no record at all) from Time Management, with a reason; routes to their real manager via `Employee.reportingToId` → `Department.managerId` → any `HR_MANAGER` fallback (`apps/api/src/services/approver-resolution.service.ts`); manager approves/rejects from a new Approvals tab; approval recomputes status/hours via the existing `computeAttendanceStatus`, tags the record `source: MANUAL`, and notifies both sides (falls back to notifying every `HR_MANAGER` in the office if no specific approver resolves, so a request never goes unnoticed).
- **Fixed a real UTC/local-timezone bug**: `dateToMinutes` in `packages/utils/src/attendance.ts` read check-in/check-out via local `getHours()`/`getMinutes()`, but every check-in/check-out in this app is stored and labelled as UTC — on any machine whose system timezone isn't UTC+0, late/early/overtime calculations silently drifted by that offset. Also affected `manualEntry`/`bulkImport`, which additionally never resolved the employee's actual office shift at all (always defaulted to UK hours regardless of BD/UK). All three now correctly UTC-anchor and office-resolve; five frontend display helpers that rendered times via the viewer's browser timezone instead of UTC were fixed the same way.
- **Roles & Permissions Settings tab** (SUPER_ADMIN-only, `/settings/roles`): a static reference matrix of what each of the 5 roles can do, plus a searchable people list with a role-change action (`PATCH /employees/:id/role`) guarded against self-role-change and demoting the last active `SUPER_ADMIN`.
- Fixed `/payroll/[id]` using the Next.js 15 async-`params` convention (`use(params)`) on this Next.js 14 app — switched to `useParams()`.
- **`DEPT_MANAGER` role + reporting-chain approval routing + 80-person demo roster** (renamed from `TEAM_LEAD`, same hierarchy level 2 — see RBAC below): implements most of what `docs/superpowers/specs/2026-07-13-role-management-scoping-design.md` proposed (leave-approval and attendance late-excuse/adjustment-review authorization now route through the real reporting chain — `apps/api/src/services/approver-resolution.service.ts` — instead of a flat "any user with this role in the office" lookup), plus the org-structure/dashboard changes below. That spec's salary-read scoping was **not** touched by this work and remains not-done. Highlights:
  - `HR_MANAGER` is now read-only on leave/late-excuse/attendance-adjustment approvals — can see every pending item office-wide but has no approve/reject action (write routes switched from `requireRole` to `requireExactRole(DEPT_MANAGER, DEPT_HEAD, SUPER_ADMIN)`; GET/list routes unchanged, still hierarchy-inherited for visibility).
  - Each department has exactly one `DEPT_HEAD` (enforced at role-change time, see RBAC below) whose leave/excuse/adjustment requests — and `HR_MANAGER`'s own — escalate to the `DEPT_HEAD` of the `HR` department specifically, not to `SUPER_ADMIN` or any other department head.
  - `listPendingExcuses` was previously unscoped (returned every pending late-excuse office-wide regardless of caller); now scoped the same way as leave/adjustments.
  - `approveCancelLeave`/`rejectCancelLeave` had **no authorization check at all** before this change (any authenticated manager-tier caller could act on any office's cancel-request); now gated the same as every other team-request action.
  - Demo seed (`prisma/src/seed-demo.ts`) expanded from ~28 to 80 employees, 10 per department across all 8 BD departments, each with a real job title (`prisma/src/seed.ts`'s `jobTitlesByDept` expanded to match) — one `DEPT_HEAD` and 1-2 `DEPT_MANAGER`s per department with real `reportingToId` chains, plus a new `farzana` (HR `DEPT_HEAD`, distinct from `sarah` who stays `HR_MANAGER`). `Department.managerId` is derived from the roster's `DEPT_HEAD` at seed time (throws if a department ends up with 0 or 2+), replacing a hardcoded name→department dict. Job-title/department typos in the roster now fail the seed loudly up front instead of a silent `console.warn` mid-run.
  - Dashboard: `DEPT_HEAD`/`DEPT_MANAGER` now render the employee-style dashboard (own attendance/leave/team), not the company-wide stats view — that stays `SUPER_ADMIN`/`HR_MANAGER`-only (`apps/web/src/app/(dashboard)/page.tsx`). `GET /dashboard/me`'s "My team" card shows a `DEPT_HEAD`'s *entire* department (not just their 1-2 direct reports — they're the top of it), sorted `DEPT_HEAD` → `DEPT_MANAGER` → `EMPLOYEE` then name, each row showing designation; `DEPT_MANAGER`/individual contributors still see direct reports, falling back to department siblings (now with `orderBy`, fixing a prior silent-truncation risk) only for ICs. The "My Manager" card is suppressed entirely for `DEPT_HEAD` — the `reportingToId` some heads carry (e.g. Habib → Tanvir, cross-sub-department org-chart continuity under IT) isn't a functional line-manager relationship worth its own card; that hierarchy shows via the team card's ordering instead. `EmployeeDashboard.tsx` additionally surfaces `RecentApprovalsCard` beside `AnnouncementsCard` (same top row as Today's Status/Leave Balance) and department/team headcount context for `DEPT_MANAGER`/`DEPT_HEAD` viewers; the team list scrolls after ~4 rows via a themed `.scrollbar-thin` utility (`globals.css`) instead of the default browser scrollbar.
  - **Time Management is now department-scoped for `DEPT_HEAD`/`DEPT_MANAGER`**: previously any manager-tier role could pick any department (or any `employeeId`) via `GET /attendance`'s query params and see office-wide attendance — office-scoped only, no department restriction. New `apps/api/src/middleware/department.middleware.ts` (`departmentScope`, mirrors `office.middleware.ts`'s pattern one level down) resolves and force-applies the caller's own department for `DEPT_HEAD`/`DEPT_MANAGER`, overriding/ignoring any client-supplied `departmentId` — wired into `GET /attendance` only (ahead of `requireRole`, after `officeScope`). `SUPER_ADMIN`/`HR_MANAGER` are unaffected (still office-wide). Deliberately scoped to attendance data, not `GET /employees` — the general employee directory intentionally stays visible to `DEPT_HEAD`/`DEPT_MANAGER` per the Roles & Permissions matrix (`/settings/roles`), so the security boundary here is the attendance records themselves, not the picker list. `AuthUser` (`packages/types/src/auth.ts`) gained `departmentId` (alongside the existing `departmentName`) so the frontend can lock the Time Management department filter to the caller's own department without an extra request — `timemanagement/page.tsx` replaces the "All Departments" `<select>` with a static read-only label for these two roles. Regression-tested in `attendance.service.listAttendance.test.ts` (asserts `departmentScope` wins over a mismatched `query.departmentId`, and still applies even when a client also passes a specific `employeeId`). `POST /attendance` (manual entry / correction) followed the same shape: was `requireRole(HR_MANAGER)` only, now `requireRole(DEPT_MANAGER)` with `departmentScope` also applied — `DEPT_HEAD`/`DEPT_MANAGER` can now directly edit/correct attendance for their own department's employees from Time Management's edit-pencil action (previously admin-only; they could only view), enforced in `manualEntry()` (`attendance.service.ts`, also newly office-scoped — a pre-existing gap where the target employee's office was never checked against the caller's `officeScope` at all). Frontend `canEdit`/`canRequest` in `timemanagement/page.tsx` generalized from `isAdmin` to `isManager`. Regression-tested in `attendance.service.manualEntry.test.ts` (403 across departments, success within one, unrestricted for HR_MANAGER/SUPER_ADMIN).
- **Fixed a real dashboard staleness bug**: "My Applications" (and the rest of `EmployeeDashboard`) didn't reflect a just-submitted/approved/rejected/cancelled leave application until a manual page reload. Root cause: `useApplyLeave`/`useApproveLeave`/`useCancelLeave`/`useApproveCancelLeave` (`apps/web/src/lib/api/hooks/useLeave.ts`) invalidated React Query key `['dashboard', 'me']`, but `useMyDashboard` (`useMyDashboard.ts`) actually queries under `['my-dashboard']` — a single-string key, not a two-element array — so the invalidation was a silent no-op (no matching prefix). `useAttendance.ts`'s mutations already used the correct `['my-dashboard']` key, which is why this only affected leave actions, not attendance ones. Fixed all four call sites to invalidate `['my-dashboard']`.
- **Fixed a real cross-account query-cache leak**: after the fix above, a report surfaced where a logged-in `DEPT_HEAD` (no leave applications of their own, confirmed against the DB) still saw *someone else's* applications on `/leave`, not matching the (correctly empty) dashboard card. Root cause: every "my X" React Query key (`['my-dashboard']`, `['leave','applications','me',status]`, leave balances, etc.) is scoped by query key alone, not by user id — and `logout()` (`apps/web/src/lib/api/auth.ts`) never cleared the React Query cache, only the Zustand auth store. Since the Sidebar's logout uses a client-side `router.replace('/login')` (not a hard reload), the `QueryClient` instance — previously created via `useState(() => new QueryClient(...))` inside `providers.tsx`, so it lived for the whole SPA session — survived the account switch, leaking the previous user's cached "my X" data into the newly logged-in user's session until each individual query's own `staleTime` happened to expire. Fixed by extracting a shared singleton (`apps/web/src/lib/queryClient.ts`, exported so non-component modules can reach it) and calling `queryClient.clear()` in `logout()`. (The 401-refresh-failure path in `client.ts` already does a hard `window.location.href` redirect, which resets the JS runtime entirely, so it was never actually vulnerable to this — no change needed there.) A tab that was already polluted before this fix still needs one manual reload/re-login to clear its existing stale cache; the fix only prevents it going forward.

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

**Deferred, no code exists yet (do not build without an explicit ask):** Onboarding (schema-only `OnboardingTask` stub), Performance Reviews, Recruitment/ATS, Asset Management, Mobile app.

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
npx pnpm@9 db:seed       # seed offices, departments, job titles, leave types, holidays, super admin
npx pnpm@9 db:seed-demo  # seed 80 demo employees (10/department, 1 DEPT_HEAD + DEPT_MANAGER(s) each) with attendance, leave, payroll, role logins

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
SUPER_ADMIN(5) > HR_MANAGER(4) > DEPT_HEAD(3) > DEPT_MANAGER(2) > EMPLOYEE(1)
```

Passing a role allows that role **and all roles above it** — this is why `HR_MANAGER` still passes every `requireRole(DEPT_MANAGER)` gate used on GET/list endpoints (office-wide **view** access to approvals is intentional). Use `requireExactRole` when a specific allow-list (not "this role or higher") is needed — this is how `HR_MANAGER` is excluded from actually approving/rejecting: every leave/attendance-adjustment/late-excuse **write** endpoint uses `requireExactRole(DEPT_MANAGER, DEPT_HEAD, SUPER_ADMIN)` instead of `requireRole`, so HR_MANAGER can see the queue but has no action buttons. Use `selfOrRole(paramName, ...roles)` for routes where an employee should be able to act on their own record even without the listed role (e.g. uploading their own avatar or editing their own profile sub-resources) — it passes if `req.params[paramName]` matches the caller's `employeeId` OR they hold one of `roles`+. `isSelfOrRole(user, targetEmployeeId, ...roles)` is the same check as a plain predicate, for use inside controllers/services when the target id isn't a route param (e.g. resolved from a DB row or a multipart body).

`DEPT_HEAD` is unique per department, enforced at write-time: `updateEmployeeRole` (`employees.service.ts`) rejects promoting a second person to `DEPT_HEAD` in a department that already has one (reassign/demote the existing head first). `Department.managerId` is always that department's `DEPT_HEAD`.

**Team-request approval routing** (leave, late-excuse review, attendance-adjustment review) is resolved via the real reporting chain, not a flat "any user with this role in the office" lookup — see `apps/api/src/services/approver-resolution.service.ts`:
- An `EMPLOYEE`/`DEPT_MANAGER` requester's application routes to their `Employee.reportingToId` (their real `DEPT_MANAGER`) if set, else falls back to their department's `DEPT_HEAD` (`Department.managerId`).
- A `DEPT_HEAD` or `HR_MANAGER` requester's own application escalates to the `DEPT_HEAD` of the `HR` department specifically (`resolveHrDeptHeadApprover`) — not to `SUPER_ADMIN`, and not to any other department's head.
- Whoever resolves as approver can act on it; **additionally**, the requester's own department `DEPT_HEAD` can always act on any pending team request in their department even if it routed to a different `DEPT_MANAGER` (`canActOnTeamRequest`'s override) — `SUPER_ADMIN` can always act on anything.
- `HR_MANAGER` never resolves as an approver and never passes `canActOnTeamRequest` — by design, per the RBAC paragraph above, they are read-only on this whole flow.

### API modules

Located in `apps/api/src/modules/`. Each module follows:
`<name>.routes.ts` → `<name>.controller.ts` → `<name>.service.ts` + `<name>.schemas.ts` (Zod)

Register the router in `apps/api/src/app.ts` under `/api/v1/<name>`.

Current modules: `announcements`, `approvals`, `auth`, `attendance`, `company`, `dashboard`, `departments`, `documents`, `employees`, `holidays`, `job-grades`, `leave`, `notifications`, `payroll`, `salary`

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
- `LeaveType.approvalChain` is a `Json` column storing `[{level: number, role: string}]` — **no longer read for routing** (see RBAC's reporting-chain paragraph above); kept in schema only for historical data, superseded by `approver-resolution.service.ts`. `LeaveApprovalHistory.level` is likewise a display-only historical field now, since approval is single-step-with-override rather than sequential.
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
