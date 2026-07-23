# HR System

A full-stack, multi-office Human Resources Management System. It ships today configured for two offices — **Bangladesh (BD)** and **United Kingdom (UK)** — each with its own tax regime, currency, shift hours, leave policy, and holiday calendar, but offices are no longer hardcoded: a Super Admin can add, deactivate, or reactivate offices directly from the app, and every office-scoped filter across the system reacts accordingly.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI primitives + `class-variance-authority`, Zustand, TanStack Query, React Hook Form, Recharts, Framer Motion |
| Backend | Node.js + Express, JWT auth (access/refresh/temp tokens), Zod validation |
| Database | Supabase (PostgreSQL) + Prisma ORM |
| Real-time | Supabase Realtime (notifications), with a polling fallback |
| File storage | Supabase Storage (avatars, documents, payslips — signed URLs, never streamed through the API) |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
hr-system/
├── apps/
│   ├── web/          → Next.js 14 frontend (port 3000)
│   ├── api/          → Node.js + Express backend (port 4000)
│   └── mobile/       → empty — reserved for a future React Native app, not started
├── packages/
│   ├── types/        → Shared TypeScript enums & interfaces (zero runtime deps)
│   ├── utils/        → Date/timezone helpers, leave calculator, BD/UK tax engine, currency, pagination
│   └── ui/           → empty — reserved for a future shared component package, not started
├── prisma/           → Single schema.prisma, migrations, and seed scripts (seed + seed-demo)
├── docker-compose.yml
└── turbo.json
```

## Prerequisites

- Node.js 20+
- `npx pnpm@9` (pnpm isn't required as a global install — every command in this repo is run through `npx pnpm@9`)
- A [Supabase](https://supabase.com) project (free tier is enough) — this app talks to Supabase Postgres directly; local Docker Postgres is an alternative for fully offline development
- Docker (optional, only if you want a local Postgres instead of Supabase)

## Getting Started

### 1. Clone and install dependencies

```bash
git clone https://github.com/kaziragib18/HR-System.git
cd HR-System
npx pnpm@9 install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values (validated at API startup — it fails fast with a clear error if anything's missing):

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (pooled/URI mode) |
| `DIRECT_URL` | Supabase → Settings → Database → Connection string (direct, used for migrations) |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `JWT_SECRET` | Any random 32+ character string |
| `JWT_REFRESH_SECRET` | Any random 32+ character string (different from above) |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend-visible copies of the above (Next.js requires the `NEXT_PUBLIC_` prefix) |

### 3. (Optional) Start a local database

If you'd rather not point straight at Supabase during development:

```bash
docker compose up -d
```

### 4. Run database migrations & seed

```bash
npx pnpm@9 db:migrate    # applies all migrations
npx pnpm@9 db:generate   # regenerates the Prisma client (re-run after any schema.prisma change)
npx pnpm@9 db:seed       # seeds offices, departments, job grades, leave types, holidays, salary structures, super admin
npx pnpm@9 db:seed-demo  # optional — seeds ~100 demo employees across every department with attendance/leave/payroll history
```

The base seed creates a Super Admin account:
- **Email:** `admin@company.com`
- **Password:** `Admin@123`

> Change this password immediately after first login.

### 5. Start development servers

```bash
npx pnpm@9 dev
```

Starts both apps concurrently via Turborepo:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

## Common Commands

```bash
npx pnpm@9 build        # build all apps
npx pnpm@9 typecheck    # type-check every package
npx pnpm@9 lint         # lint every package
npx pnpm@9 test         # run the Vitest suite (packages/utils + apps/api)

npx pnpm@9 db:migrate   # apply pending migrations
npx pnpm@9 db:generate  # regenerate the Prisma client
npx pnpm@9 db:studio    # open Prisma Studio at http://localhost:5555
npx pnpm@9 db:seed      # re-seed core data (idempotent — safe to re-run)
npx pnpm@9 db:seed-demo # re-seed demo employees (idempotent — replaces all @xyztech.com demo accounts, leaves everything else alone)

npx pm2 start ecosystem.config.js   # production process manager
```

## Features

### Auth & Security
- Login with JWT access tokens (15 min, kept in memory only — never `localStorage`) and httpOnly-cookie refresh tokens (7 days), with silent refresh and a request queue to prevent parallel-refresh races.
- TOTP-based two-factor authentication (setup/enable/disable, QR code enrollment).
- Per-device session management — view and revoke your own active sessions.
- HR-relay password reset (HR generates a one-time reset link from an employee's profile; there's no email delivery, so self-service "forgot password" just points users to contact HR).

### Employees
- Full CRUD, org chart, avatar upload, bank info, soft-delete/reactivate.
- Profile sub-resources: work experience, education, skills, certifications, identification documents.
- Super Admin role management, with guardrails (can't demote the last active Super Admin, exactly one `DEPT_HEAD` per department).

### Departments & Offices
- Department CRUD, org tree, Head/Manager appointment (which also switches the appointee's system role).
- **Department codes are unique per office, not globally** — BD and UK can each have their own "Accounts" or "Human Resources" department independently.
- The Departments page splits into **per-office tabs** for Super Admin, sourced from the live office list.
- **Offices are fully manageable from the Company tab**: create a new office (any code/name/currency/timezone/shift hours), edit an existing one, or deactivate/reactivate one — deactivation is blocked while the office still has active employees. Every office-scoped filter across the app (Employees, Salary, Roles, Holidays, Attendance, department pickers) automatically hides itself when only one office is active, and reappears the moment a second one is added.
- A real-time **office clock** appears on every dashboard, driven by each office's actual timezone; a Super Admin can turn each office's clock on/off from the Company tab (a shared setting, not a per-user preference).

### Attendance
- Self check-in/check-out, calendar view, manual entry, bulk (biometric) import.
- Per-office shift hours (configurable per office, not hardcoded) drive lateness/overtime calculation.
- Late-excuse submission and reporting-chain-based review.
- Employee-initiated attendance adjustment requests, routed to the real manager and approved/rejected from the Approvals page.
- Time Management is department-scoped for `DEPT_HEAD`/`DEPT_MANAGER` (their own department only) and office-scoped for HR roles.

### Leave
- Apply, cancel, and cancel-with-approval flows, resolved through the real reporting chain (not a flat role lookup) — with an explicit escalation path for `DEPT_HEAD`/`HR_MANAGER`'s own requests.
- Per-office leave types and balances (annual, sick, casual, maternity, unpaid, and a zero-allowance "Compensatory Leave" that only appears once actually used).
- Automatic lifecycle sweep: a still-pending application auto-rejects once its start date arrives (Sick Leave excepted), and the resolved approver gets a reminder the day before.
- Weekend/public-holiday warnings on the apply form.

### Payroll & Salary
- Payroll run lifecycle (draft → process → approve → paid), with audited state changes.
- Real BD income-tax slabs and UK PAYE + National Insurance calculation (multi-band, regression-tested).
- Per-grade salary structures, office-scoped reads, payslips.
- A newly created office beyond BD/UK gets a clear, non-crashing error when payroll tax isn't configured for it yet — a documented gap, not a silent wrong number.

### Documents & Company
- Document vault via Supabase signed URLs (upload-type validated, soft-delete).
- Company profile (logo, address, contact info), compliance document library visible to every employee.
- Public holiday calendar management per office.

### Approvals, Notifications & Announcements
- A single consolidated Approvals page aggregating leave, late-excuse, and attendance-adjustment requests.
- Real-time notifications via Supabase Realtime with a polling fallback; broadened so office admins are copied on new team requests, not just the resolved approver.
- A company announcements feed combining manual posts (Super Admin/HR Manager) with automatically computed items (new joiners, birthdays, work anniversaries, upcoming holidays, new policy documents).

### Dashboard & Directory
- Role-aware dashboard (admin/manager view vs. employee/team-lead view), headcount-by-department chart with a BD/UK filter, recent-approvals feed, compliance docs, announcements.
- Company-wide contact book.

### Settings
- Profile, Security (password, 2FA, sessions), a 14-variant Appearance theme picker (persisted per account, with a circular reveal transition), and a Super Admin-only Roles & Permissions reference + role-change tool.

## Roles & Permissions

Five roles, in a strict hierarchy: `SUPER_ADMIN` > `HR_MANAGER` > `DEPT_HEAD` > `DEPT_MANAGER` > `EMPLOYEE`. Higher roles inherit lower roles' read access; `HR_MANAGER` is deliberately **read-only** on leave/attendance-adjustment/late-excuse approvals (visibility office-wide, but no approve/reject button) — approval authority follows the real reporting chain instead of a flat role check.

## Multi-Office Support (as configured today)

| | Bangladesh (BD) | United Kingdom (UK) |
|---|---|---|
| Currency | BDT | GBP |
| Timezone | Asia/Dhaka (UTC+6) | Europe/London (BST/GMT) |
| Default shift hours | 13:30–22:00 | 09:00–17:00 |
| Tax regime | BD Income Tax slabs | UK PAYE + National Insurance |
| Annual leave | 18 days | 28 days (statutory minimum) |
| Sick leave | 14 days | 10 days |
| Casual / unpaid leave | 10 / 30 days | not offered |
| Maternity leave | 112 days | 260 days |

Both offices' currency, timezone, shift hours, and tax regime are stored data, editable from the Company tab — this table reflects the seeded defaults, not a hardcoded limit. Adding a third office is fully supported for departments, employees, attendance, and leave; payroll tax calculation for a jurisdiction beyond BD/UK requires an engineer to add real tax-law logic first (it fails with a clear error rather than a wrong number in the meantime).

## API Overview

Base URL: `http://localhost:4000/api/v1`. All protected routes require an `Authorization: Bearer <accessToken>` header.

| Module | Example routes |
|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/*`, `/auth/sessions` |
| Employees | `GET/POST /employees`, `GET/PATCH /employees/:id`, `PATCH /employees/:id/role` |
| Departments | `GET/POST /departments`, `GET /departments/tree`, `PATCH /departments/:id/appoint` |
| Company | `GET/POST /company/offices`, `PATCH /company/offices/:id/deactivate`, `/company/compliance-docs` |
| Attendance | `GET/POST /attendance`, `POST /attendance/bulk-import`, `PATCH /attendance/:id/review-adjustment` |
| Leave | `GET/POST /leave/applications`, `PATCH /leave/applications/:id/approve` |
| Payroll | `GET/POST /payroll/runs`, `POST /payroll/runs/:id/process`, `/approve`, `/mark-paid`, `GET /payroll/me` (self-service payslips) |
| Salary | `GET/POST /salary`, `GET /salary/:employeeId` |
| Approvals | `GET /approvals/history` (read-only, aggregates across modules) |
| Announcements | `GET /announcements/feed`, `POST /announcements` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |
| Dashboard | `GET /dashboard/stats`, `/dashboard/headcount-by-department` |
| Holidays / Job Grades / Documents | `GET/POST /holidays`, `/job-grades`, `/documents` |

## Known Limitations

- Several backend modules (salary, documents, notifications, dashboard, holidays, job-grades, auth) and all of the frontend still have no automated test coverage.
- No CI pipeline runs tests/typecheck/lint automatically yet — everything is verified locally.
- **Not built** (deferred, no code exists): Onboarding workflow, Performance Reviews, Recruitment/ATS, Asset Management, mobile app.
- **Intentionally removed**: Timesheets — it duplicated attendance-based Time Management and was never adopted by the frontend.

## Deployment

| Service | Platform | Free tier |
|---|---|---|
| Frontend (web) | [Vercel](https://vercel.com) | Hobby plan |
| Backend (api) | [Render](https://render.com) | Free (sleeps after 15 min) |
| Database | [Supabase](https://supabase.com) | 500MB, always-on |
| File storage | Supabase Storage | 1GB |
| Real-time | Supabase Realtime | Included |

All services are upgrade-compatible — moving to a paid tier requires no code changes, only a plan/environment variable update.

## Contributing

This is an internal project. For questions or issues, contact the development team.

## License

Private — all rights reserved.
