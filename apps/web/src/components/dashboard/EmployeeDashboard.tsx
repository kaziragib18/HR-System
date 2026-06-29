'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMyDashboard, type MyDashboard, type ManagerInfo } from '@/lib/api/hooks/useMyDashboard'
import { useTodayAttendance } from '@/lib/api/hooks/useAttendance'
import { Card, Avatar, StatusBadge, Spinner } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import {
  LogIn,
  Clock,
  Plus,
  FileText,
  ShieldCheck,
  Coins,
  Award,
  Building2,
  User,
  Download,
} from 'lucide-react'

const OFFICE_SHIFT: Record<string, { start: string; end: string; label: string }> = {
  BD: { start: '13:30', end: '22:00', label: '1:30 PM – 10:00 PM' },
  UK: { start: '09:00', end: '17:00', label: '9:00 AM – 5:00 PM' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {data.me?.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {data.me.department}
                </span>
              )}
              {data.me?.managerName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Manager: {data.me.managerName}
                </span>
              )}
            </div>
          </div>
        </div>
        <DualClock />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayStatusCard officeCode={user?.officeCode} />
        {/* Leave balance + manager side by side in the 2-col slot */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <LeaveBalanceCard balances={data.leaveBalances} />
          {data.managers.length > 0 && <ManagerCard managers={data.managers} />}
        </div>
        <AttendanceCalendar className="lg:col-span-3" />
        <TeamTodayCard team={data.team} />
        <MyApplicationsCard applications={data.myApplications} />
        <ComplianceDocsCard />
      </div>
    </div>
  )
}

function TodayStatusCard({ officeCode }: { officeCode?: string }) {
  const { data: today } = useTodayAttendance()
  const [elapsed, setElapsed] = useState('')

  // Live timer: ticks every second while checked in but not checked out
  useEffect(() => {
    if (!today?.checkIn) {
      setElapsed('')
      return
    }
    if (today.checkOut) {
      // Already checked out — show static total
      const mins = today.workingMinutes ?? 0
      setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`)
      return
    }
    function tick() {
      const diffMs = Date.now() - new Date(today!.checkIn!).getTime()
      const totalSecs = Math.floor(diffMs / 1000)
      const h = Math.floor(totalSecs / 3600)
      const m = Math.floor((totalSecs % 3600) / 60)
      const s = totalSecs % 60
      setElapsed(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [today?.checkIn, today?.checkOut, today?.workingMinutes])

  const status = today?.status ?? 'ABSENT'
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  const officeShift = OFFICE_SHIFT[officeCode ?? 'UK'] ?? OFFICE_SHIFT['UK']

  const checkInTime = fmtTime(today?.checkIn ?? null)
  const checkOutTime = today?.checkOut ? fmtTime(today.checkOut) : null

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Today&apos;s status
        </p>
        <StatusBadge status={status} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>

      {/* Check-in time — shown prominently when checked in */}
      {today?.checkIn ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <LogIn className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Checked in
              </p>
              <p className="text-lg font-semibold leading-none text-emerald-600 dark:text-emerald-400">
                {checkInTime}
              </p>
            </div>
          </div>

          {/* Work period bar */}
          <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Work period
            </p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-emerald-600 dark:text-emerald-400">{checkInTime}</span>
              <span className="text-muted-foreground">→</span>
              {checkOutTime ? (
                <span className="text-foreground">{checkOutTime}</span>
              ) : (
                <span className="text-muted-foreground italic text-xs">ongoing</span>
              )}
              {elapsed && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {elapsed}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <LogIn className="h-4 w-4" />
          <span>Not checked in yet</span>
        </div>
      )}

      {/* Office hours */}
      <div className="mt-3 border-t pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Office hours ({officeCode ?? 'UK'})</span>
          <span className="font-medium">{officeShift.label}</span>
        </div>
      </div>
    </Card>
  )
}

function LeaveBalanceCard({ balances }: { balances: MyDashboard['leaveBalances'] }) {
  return (
    <Card>
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

// ── Dual Clock ─────────────────────────────────────────────────────────────────

function DualClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  function clockParts(tz: string) {
    const fmtTime = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now)
    // "1:45:30 PM" → h="1", m="45", s="30", period="PM"
    const match = fmtTime.match(/^(\d+):(\d+):(\d+)\s*(AM|PM)$/)
    const h = match?.[1] ?? '12'
    const m = match?.[2] ?? '00'
    const s = match?.[3] ?? '00'
    const period = match?.[4] ?? 'AM'
    const tzLabel =
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
        .format(now)
        .split(', ')
        .at(-1)
        ?.split(' ')
        .at(-1) ?? tz
    const dayDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(now)
    return { h, m, s, period, tzLabel, dayDate }
  }

  const bd = clockParts('Asia/Dhaka')
  const uk = clockParts('Europe/London')

  return (
    <div className="flex items-center gap-5 rounded-xl border bg-card px-5 py-3 shadow-sm">
      <ClockFace
        label="BD TIME"
        tz={bd.tzLabel}
        h={bd.h}
        m={bd.m}
        s={bd.s}
        period={bd.period}
        dayDate={bd.dayDate}
        accentClass="text-amber-500 dark:text-amber-400"
      />
      <div className="h-10 w-px bg-border" />
      <ClockFace
        label="UK TIME"
        tz={uk.tzLabel}
        h={uk.h}
        m={uk.m}
        s={uk.s}
        period={uk.period}
        dayDate={uk.dayDate}
        accentClass="text-sky-500 dark:text-sky-400"
      />
    </div>
  )
}

function ClockFace({
  label,
  tz,
  h,
  m,
  s,
  period,
  dayDate,
  accentClass,
}: {
  label: string
  tz: string
  h: string
  m: string
  s: string
  period: string
  dayDate: string
  accentClass: string
}) {
  return (
    <div className="text-center">
      <p className="mb-1 text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label} <span className={cn('font-bold', accentClass)}>{tz}</span>
      </p>
      <div className="flex items-baseline font-mono font-bold text-foreground">
        <span className="text-2xl">{h}</span>
        <span className="mx-0.5 text-lg text-muted-foreground/50">:</span>
        <span className="text-2xl">{m}</span>
        <span className="mx-0.5 text-lg text-muted-foreground/50">:</span>
        <span className={cn('text-base', accentClass)}>{s}</span>
        <span className={cn('ml-1 text-xs font-semibold', accentClass)}>{period}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground/60">{dayDate}</p>
    </div>
  )
}

// ── Manager Card ───────────────────────────────────────────────────────────────

function ManagerCard({ managers }: { managers: ManagerInfo[] }) {
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        My Manager
      </p>
      <div className="space-y-3">
        {managers.map((mgr) => (
          <div key={mgr.id} className="flex items-center gap-3">
            <Avatar
              firstName={mgr.firstName}
              lastName={mgr.lastName}
              url={mgr.avatarUrl}
              size={36}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">
                {mgr.firstName} {mgr.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{mgr.relation}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

interface ComplianceDoc {
  id: string
  title: string
  description?: string | null
  mimeType?: string | null
  fileSize?: number | null
  createdAt: string
}

function ComplianceDocsCard() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['compliance-docs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/compliance-docs')
      return data.data as ComplianceDoc[]
    },
  })

  async function handleDownload(id: string) {
    const { data } = await apiClient.get(`/company/compliance-docs/${id}/download-url`)
    window.open(data.data.downloadUrl, '_blank')
  }

  function fmtSize(bytes?: number | null) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`
    return ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isLoading && docs.length === 0) {
    return (
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Compliance &amp; Policy Documents
        </p>
        <div className="space-y-1">
          {[
            { icon: FileText,    title: 'Leave & attendance policy',      desc: 'Encashment, carry-forward, WFH' },
            { icon: ShieldCheck, title: 'Code of conduct & IT security',  desc: 'Data handling, device use' },
            { icon: Coins,       title: 'Payroll & tax policy',           desc: 'Payslip schedule, TDS rules' },
            { icon: Award,       title: 'Performance & appraisal',        desc: 'KPI framework, review cycle' },
          ].map((p) => (
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

  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Compliance &amp; Policy Documents
      </p>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 border-b py-2 last:border-0">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                {doc.description && (
                  <p className="truncate text-[11px] text-muted-foreground">{doc.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {fmtSize(doc.fileSize)}
                </p>
              </div>
              <button
                onClick={() => handleDownload(doc.id)}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
