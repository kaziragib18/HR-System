'use client'

import { useMyDashboard, type MyDashboard } from '@/lib/api/hooks/useMyDashboard'
import { Card, Avatar, StatusBadge, Spinner } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { LogIn, LogOut, Clock, Plus, FileText, ShieldCheck, Coins, Award } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const LEAVE_COLORS: Record<string, string> = {
  AL: 'bg-blue-500',
  SL: 'bg-emerald-500',
  CL: 'bg-amber-500',
  ML: 'bg-rose-500',
  UL: 'bg-slate-500',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sd = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`
}

export function EmployeeDashboard() {
  const { user } = useAuthStore()
  const { data, isLoading } = useMyDashboard()

  if (isLoading) return <Spinner />
  if (!data) return null

  const now = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            firstName={user?.firstName ?? '?'}
            lastName={user?.lastName ?? '?'}
            url={user?.avatarUrl}
            size={48}
          />
          <div>
            <h1 className="text-xl font-semibold">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.role.replace(/_/g, ' ')} · {user?.officeCode} office
            </p>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{monthLabel}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayStatusCard today={data.today} />
        <LeaveBalanceCard balances={data.leaveBalances} />
        <AttendanceCalendar attendance={data.attendanceMonth} />
        <TeamTodayCard team={data.team} />
        <MyApplicationsCard applications={data.myApplications} />
        <PolicyHub />
      </div>
    </div>
  )
}

function TodayStatusCard({ today }: { today: MyDashboard['today'] }) {
  const status = today?.status ?? 'ABSENT'
  const hours = today?.workingMinutes
    ? `${Math.floor(today.workingMinutes / 60)}h ${today.workingMinutes % 60}m`
    : '—'
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Today&apos;s status
      </p>
      <div className="mt-2 flex items-center gap-2">
        <StatusBadge status={status} />
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <Row icon={<LogIn className="h-3.5 w-3.5" />} label="Check-in">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {fmtTime(today?.checkIn ?? null)}
          </span>
        </Row>
        <Row icon={<LogOut className="h-3.5 w-3.5" />} label="Check-out">
          <span className="font-medium">{today?.checkOut ? fmtTime(today.checkOut) : 'Pending'}</span>
        </Row>
        <Row icon={<Clock className="h-3.5 w-3.5" />} label="Hours today">
          <span className="font-medium">{hours}</span>
        </Row>
      </div>
    </Card>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  )
}

function LeaveBalanceCard({ balances }: { balances: MyDashboard['leaveBalances'] }) {
  return (
    <Card className="lg:col-span-2">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Leave balance · {new Date().getFullYear()}
      </p>
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leave balances configured.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {balances.map((b) => {
            const pct = b.entitled > 0 ? Math.min(100, (b.taken / b.entitled) * 100) : 0
            return (
              <div key={b.code}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{b.name}</span>
                  <span className="font-medium">
                    {b.taken} / {b.entitled}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', LEAVE_COLORS[b.code] ?? 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{b.remaining} remaining</p>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="h-3.5 w-3.5" /> Annual leave encashment available
        </span>
        <Link href="/leave" className="font-medium text-primary">
          Apply →
        </Link>
      </div>
    </Card>
  )
}

function AttendanceCalendar({ attendance }: { attendance: MyDashboard['attendanceMonth'] }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDate = now.getDate()

  // Map day-of-month → status (parse ISO date prefix to avoid TZ drift)
  const statusByDay: Record<number, string> = {}
  attendance.forEach((a) => {
    const day = parseInt(a.date.slice(8, 10), 10)
    statusByDay[day] = a.status
  })

  const cells: Array<{ day: number | null }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })

  const legend = [
    { label: 'Present', cls: 'st-present' },
    { label: 'Late', cls: 'st-late' },
    { label: 'Absent', cls: 'st-absent' },
    { label: 'Leave', cls: 'st-leave' },
    { label: 'Holiday', cls: 'st-holiday' },
  ]

  return (
    <Card className="lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Attendance calendar · {MONTHS[month]} {year}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {legend.map((l) => (
            <span
              key={l.label}
              className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', l.cls)}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (c.day === null) return <div key={i} />
          const status = statusByDay[c.day]
          const dow = new Date(year, month, c.day).getDay()
          const isWeekend = dow === 0 || dow === 6
          const isToday = c.day === todayDate
          const cls = status
            ? `st-${status.toLowerCase()}`
            : isWeekend
              ? 'text-muted-foreground/50'
              : 'text-foreground'
          return (
            <div
              key={i}
              className={cn(
                'flex h-9 items-center justify-center rounded-md text-xs',
                cls,
                isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
            >
              {c.day}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const TEAM_STATUS_LABEL: Record<string, string> = {
  PRESENT: 'In',
  LATE: 'Late',
  ON_LEAVE: 'Leave',
  ABSENT: 'Absent',
  WEEKEND: 'Off',
  HOLIDAY: 'Holiday',
}

function TeamTodayCard({ team }: { team: MyDashboard['team'] }) {
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        My team · today
      </p>
      <div className="space-y-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar firstName={m.firstName} lastName={m.lastName} url={m.avatarUrl} size={26} />
            <span className="flex-1 text-sm">
              {m.firstName} {m.lastName}
              {m.isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
            </span>
            <StatusBadge status={m.todayStatus} label={TEAM_STATUS_LABEL[m.todayStatus]} />
          </div>
        ))}
        {team.length === 0 && <p className="text-sm text-muted-foreground">No teammates.</p>}
      </div>
    </Card>
  )
}

function MyApplicationsCard({ applications }: { applications: MyDashboard['myApplications'] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          My applications
        </p>
        <Link href="/leave" className="text-xs font-medium text-primary">
          <Plus className="mr-0.5 inline h-3 w-3" />
          New
        </Link>
      </div>
      <div className="space-y-2">
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave applications yet.</p>
        ) : (
          applications.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {a.type} · {fmtRange(a.startDate, a.endDate)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {a.totalDays} day{a.totalDays > 1 ? 's' : ''}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

const POLICIES = [
  { icon: FileText, title: 'Leave & attendance policy', desc: 'Encashment, carry-forward, WFH' },
  { icon: ShieldCheck, title: 'Code of conduct & IT security', desc: 'Data handling, device use' },
  { icon: Coins, title: 'Payroll & tax policy', desc: 'Payslip schedule, TDS rules' },
  { icon: Award, title: 'Performance & appraisal', desc: 'KPI framework, review cycle' },
]

function PolicyHub() {
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Company policy hub
      </p>
      <div className="space-y-1">
        {POLICIES.map((p) => (
          <div key={p.title} className="flex items-start gap-2 border-b py-2 last:border-0">
            <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium leading-tight">{p.title}</p>
              <p className="text-[11px] text-muted-foreground">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
