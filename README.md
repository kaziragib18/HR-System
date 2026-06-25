# HR System

A full-stack Human Resources Management System built for two offices — Bangladesh (BD) and United Kingdom (UK) — with separate tax regimes, currencies, leave policies, and holiday calendars.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, TanStack Query |
| Backend | Node.js + Express, JWT auth, node-cron |
| Database | Supabase (PostgreSQL) + Prisma ORM |
| Real-time | Supabase Realtime (push notifications) |
| File storage | Supabase Storage |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
hr-system/
├── apps/
│   ├── web/          → Next.js 14 frontend (port 3000)
│   ├── api/          → Node.js + Express backend (port 4000)
│   └── mobile/       → React Native + Expo (Phase 5)
├── packages/
│   ├── types/        → Shared TypeScript interfaces & enums
│   ├── utils/        → Date helpers, leave calculator, BD/UK tax engine
│   └── ui/           → Shared shadcn/ui components
├── prisma/           → Database schema, migrations & seed
├── docker-compose.yml
└── turbo.json
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm` or use `npx pnpm@9`)
- Docker (for local PostgreSQL)
- A [Supabase](https://supabase.com) project (free tier)

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

Fill in the required values in `.env`:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (URI mode) |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `JWT_SECRET` | Any random 32+ character string |
| `JWT_REFRESH_SECRET` | Any random 32+ character string (different from above) |

> For local development, you can use `DATABASE_URL=postgresql://postgres:password@localhost:5432/hr_system` and skip the Supabase keys until you need real-time or storage.

### 3. Start local database

```bash
docker compose up -d
```

### 4. Run database migrations & seed

```bash
npx pnpm@9 db:migrate    # creates all tables
npx pnpm@9 db:generate   # generates Prisma client
npx pnpm@9 db:seed       # seeds offices, departments, leave types, holidays, super admin
```

Seed creates a super admin account:
- **Email:** `admin@company.com`
- **Password:** `Admin@123`

> Change this password immediately after first login.

### 5. Start development servers

```bash
npx pnpm@9 dev
```

This starts both apps concurrently via Turborepo:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

## Build

```bash
npx pnpm@9 build        # build all apps
npx pnpm@9 typecheck    # type-check all packages
npx pnpm@9 lint         # lint all packages
```

## Database Commands

```bash
npx pnpm@9 db:migrate   # run pending migrations (dev)
npx pnpm@9 db:generate  # regenerate Prisma client after schema changes
npx pnpm@9 db:studio    # open Prisma Studio at http://localhost:5555
npx pnpm@9 db:seed      # reseed (idempotent — safe to re-run)
```

## Features

### Phase 1 — Core Foundation ✅ (in progress)
- [ ] Auth — login, JWT refresh tokens, 2FA (TOTP), session management
- [ ] Employee management — profiles, bank info, org chart, document vault
- [ ] Department & job grade management
- [ ] Role-based access control (Super Admin, HR Manager, Dept Head, Team Lead, Employee)
- [ ] HR dashboard

### Phase 2 — Attendance & Leave
- [ ] Attendance tracking (manual + bulk biometric import)
- [ ] Leave application & multi-level approval workflow
- [ ] Leave balance tracker
- [ ] Weekly timesheet approval
- [ ] Employee self-service portal

### Phase 3 — Notifications & Documents
- [ ] Real-time push notifications via Supabase Realtime
- [ ] Document vault with Supabase Storage
- [ ] Notice board announcements
- [ ] Onboarding workflow checklist

### Phase 4 — Payroll & Performance
- [ ] Salary structure setup per grade/band
- [ ] Monthly payroll run (BD income tax + UK PAYE)
- [ ] PDF payslip generation
- [ ] Performance reviews & appraisal cycles
- [ ] Analytics dashboard

### Phase 5 — Mobile
- [ ] React Native + Expo app
- [ ] Firebase FCM push notifications
- [ ] Recruitment ATS
- [ ] Asset management

## Multi-Office Support

| | Bangladesh (BD) | United Kingdom (UK) |
|---|---|---|
| Currency | BDT | GBP |
| Timezone | Asia/Dhaka (UTC+6) | Europe/London (BST/GMT) |
| Tax regime | BD Income Tax slabs | UK PAYE + National Insurance |
| Annual leave | 18 days | 28 days (statutory minimum) |
| Sick leave | 14 days | 10 days |

## API Overview

Base URL: `http://localhost:4000/api/v1`

All protected routes require `Authorization: Bearer <accessToken>` header.

| Module | Routes |
|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/*` |
| Employees | `GET/POST /employees`, `GET/PATCH /employees/:id` |
| Departments | `GET/POST /departments`, `GET /departments/tree` |
| Attendance | `GET/POST /attendance`, `POST /attendance/bulk` |
| Leave | `GET/POST /leave/applications`, `PATCH /leave/applications/:id/approve` |
| Timesheets | `GET/POST /timesheets`, `POST /timesheets/:id/submit` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |
| Dashboard | `GET /dashboard/stats` |

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
