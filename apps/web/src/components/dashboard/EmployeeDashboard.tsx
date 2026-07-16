'use client'

import { useState, useEffect } from 'react'
import { useMyDashboard, type MyDashboard, type ManagerInfo } from '@/lib/api/hooks/useMyDashboard'
import { useTodayAttendance } from '@/lib/api/hooks/useAttendance'
import { Card, Avatar, StatusBadge, Spinner } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { ComplianceDocsCard } from '@/components/dashboard/ComplianceDocsCard'
import { AnnouncementsCard } from '@/components/dashboard/AnnouncementsCard'
import { RecentApprovalsCard } from '@/components/dashboard/RecentApprovalsCard'
import { BD_SHIFT, UK_SHIFT, toOfficeTime, type ShiftConfig } from '@hr-system/utils'
import { UserRole } from '@hr-system/types'
import {
  LogIn,
  Clock,
  Plus,
  Building2,
  User,
} from 'lucide-react'

function shiftForOfficeCode(code?: string): ShiftConfig {
  return code === 'BD' ? BD_SHIFT : UK_SHIFT
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
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

function fmtShiftTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
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

  // DEPT_MANAGER/DEPT_HEAD get this same employee-style dashboard (see
  // (dashboard)/page.tsx), but with their team's approval queue and
  // department/team headcount surfaced alongside their own attendance/leave.
  const isTeamLead = user?.role === UserRole.DEPT_MANAGER || user?.role === UserRole.DEPT_HEAD

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Card className="flex items-center gap-3">
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
                  {isTeamLead && data.departmentHeadcount > 0 && ` · ${data.departmentHeadcount} people`}
                </span>
              )}
              {data.managers.map((mgr) => (
                <span key={mgr.id} className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {mgr.relation}: {mgr.firstName} {mgr.lastName}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <DualClock />
      </div>

      {/* Clock + manager side by side (non-team-leads only); leave balance + approvals + announcements — all in one row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TodayStatusCard officeCode={user?.officeCode} />
        {!isTeamLead && data.managers.length > 0 && <ManagerCard managers={data.managers} />}
        <LeaveBalanceCard balances={data.leaveBalances} />
        {isTeamLead && <RecentApprovalsCard />}
        <AnnouncementsCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
      // checkIn's UTC slots hold the office's LOCAL wall-clock digits (see
      // toOfficeTime), not a true UTC instant — Date.now() is true UTC, so
      // diffing them directly is off by the office's UTC offset (e.g. -6h
      // for BD). Re-express "now" the same way before diffing.
      const nowOfficeDigits = toOfficeTime(new Date(), officeCode ?? 'UK')
      const diffMs = nowOfficeDigits.getTime() - new Date(today!.checkIn!).getTime()
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000))
      const h = Math.floor(totalSecs / 3600)
      const m = Math.floor((totalSecs % 3600) / 60)
      const s = totalSecs % 60
      setElapsed(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [today?.checkIn, today?.checkOut, today?.workingMinutes, officeCode])

  const status = today?.status ?? 'ABSENT'
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  const officeShift = shiftForOfficeCode(officeCode)
  const officeShiftLabel = `${fmtShiftTime(officeShift.startTime)} – ${fmtShiftTime(officeShift.endTime)}`

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

          {/* Working Period bar */}
          <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Working Period
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
          <span className="font-medium">{officeShiftLabel}</span>
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

const TEAM_ROLE_TAG: Record<string, string> = {
  DEPT_HEAD: 'Head',
  DEPT_MANAGER: 'Manager',
}

function TeamTodayCard({ team }: { team: MyDashboard['team'] }) {
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        My team · today{team.length > 0 ? ` · ${team.length}` : ''}
      </p>
      <div className="scrollbar-thin max-h-60 space-y-2 overflow-y-auto pr-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar firstName={m.firstName} lastName={m.lastName} url={m.avatarUrl} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm">
                  {m.firstName} {m.lastName}
                  {m.isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                </span>
                {m.role && TEAM_ROLE_TAG[m.role] && (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {TEAM_ROLE_TAG[m.role]}
                  </span>
                )}
              </div>
              {m.designation && (
                <p className="truncate text-xs text-muted-foreground">{m.designation}</p>
              )}
            </div>
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

