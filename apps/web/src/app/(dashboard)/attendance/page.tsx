'use client'

import { useState, useEffect } from 'react'
import {
  useTodayAttendance,
  useMyMonthAttendance,
  useCheckIn,
  useCheckOut,
  type AttendanceRecord,
} from '@/lib/api/hooks/useAttendance'
import { useHolidays, type Holiday } from '@/lib/api/hooks/useHolidays'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { Card, StatusBadge, Spinner } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { LogIn, LogOut, Clock, AlertCircle, CalendarDays, AlertTriangle } from 'lucide-react'

const OFFICE_SHIFT: Record<string, { label: string }> = {
  BD: { label: '1:30 PM – 10:00 PM' },
  UK: { label: '9:00 AM – 5:00 PM' },
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtMinutes(mins: number): string {
  if (!mins) return '—'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function fmtHolidayDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })
}

// ── Today card with live timer ─────────────────────────────────────────────────

function TodayCard() {
  const { data: today, isLoading } = useTodayAttendance()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const { user } = useAuthStore()
  const [elapsed, setElapsed] = useState('')
  const [confirmingCheckout, setConfirmingCheckout] = useState(false)

  useEffect(() => {
    if (!today?.checkIn) {
      setElapsed('')
      return
    }
    if (today.checkOut) {
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
    month: 'long',
  })
  const officeShift = OFFICE_SHIFT[user?.officeCode ?? 'UK'] ?? OFFICE_SHIFT['UK']
  const checkInTime = fmtTime(today?.checkIn ?? null)
  const checkOutTime = today?.checkOut ? fmtTime(today.checkOut) : null

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>
        <StatusBadge status={status} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {today?.checkIn ? (
            <div className="mt-3 space-y-3">
              {/* Check-in ···dotted··· Check-out */}
              <div className="flex items-center gap-3">
                {/* Check In — left */}
                <div className="flex items-center gap-2 shrink-0">
                  <LogIn className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Check In</p>
                    <p className="text-lg font-semibold leading-none text-emerald-600 dark:text-emerald-400">
                      {checkInTime}
                    </p>
                  </div>
                </div>

                {/* Dotted connector */}
                <div className="flex-1 border-t-2 border-dashed border-muted-foreground/25" />

                {/* Check Out — right */}
                <div className="flex items-center gap-2 shrink-0">
                  <LogOut className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Check Out</p>
                    {checkOutTime ? (
                      <p className="text-lg font-semibold leading-none text-amber-600 dark:text-amber-400">
                        {checkOutTime}
                      </p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground leading-none">Pending</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Work period bar */}
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Work period</p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400">{checkInTime}</span>
                  <span className="text-muted-foreground">→</span>
                  {checkOutTime ? (
                    <span className="text-foreground">{checkOutTime}</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">ongoing</span>
                  )}
                  {elapsed && (
                    <span className="ml-auto flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {elapsed}
                    </span>
                  )}
                </div>
              </div>

              {/* Late warning */}
              {(today.lateMinutes ?? 0) > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Late by {today.lateMinutes} min
                  </span>
                </div>
              )}
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
              <span className="text-muted-foreground">
                Office hours ({user?.officeCode ?? 'UK'})
              </span>
              <span className="font-medium">{officeShift.label}</span>
            </div>
          </div>

          {/* Checkout confirmation warning */}
          {confirmingCheckout && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Confirm check-out?
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Once checked out, you cannot check in again today.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => {
                        checkOut.mutate(undefined)
                        setConfirmingCheckout(false)
                      }}
                      disabled={checkOut.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Yes, check out
                    </button>
                    <button
                      onClick={() => setConfirmingCheckout(false)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          {!confirmingCheckout && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => checkIn.mutate(undefined)}
                disabled={checkIn.isPending || !!today?.checkIn}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                {checkIn.isPending ? 'Checking in…' : today?.checkIn ? 'Checked in' : 'Check In'}
              </button>
              <button
                onClick={() => {
                  if (!today?.checkIn || !!today?.checkOut) return
                  setConfirmingCheckout(true)
                }}
                disabled={checkOut.isPending || !today?.checkIn || !!today?.checkOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {checkOut.isPending
                  ? 'Checking out…'
                  : today?.checkOut
                    ? 'Checked out'
                    : 'Check Out'}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ── Check-in / Check-out history ──────────────────────────────────────────────

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function fmtDateLabel(dateStr: string): string {
  // Normalise to YYYY-MM-DD regardless of whether the API returns a full ISO string
  const ymd = dateStr.slice(0, 10)
  const d = new Date(ymd + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${d.getFullYear()}`
}

function fmtWorkDuration(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} hr${h > 1 ? 's' : ''} ${m > 0 ? `${m} min` : ''}`.trim() : `${m} min`
}

function CheckInOutHistory() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { data: records = [], isLoading } = useMyMonthAttendance(month, year)
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  function prevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  // Only records that have a check-in, newest first
  const entries = [...records]
    .filter((r: AttendanceRecord) => !!r.checkIn)
    .sort((a: AttendanceRecord, b: AttendanceRecord) => b.date.localeCompare(a.date))

  return (
    <Card className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Check-in / Check-out
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="rounded p-1 text-xs hover:bg-muted transition-colors"
          >
            ‹
          </button>
          <span className="min-w-[80px] text-center text-xs font-semibold">
            {MONTHS_SHORT[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="rounded p-1 text-xs hover:bg-muted transition-colors disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No check-ins this month.</p>
      ) : (
        <div className="max-h-[240px] overflow-y-auto -mx-4 px-4 divide-y">
          {entries.map((r: AttendanceRecord) => {
            const dow = new Date(r.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
            })
            return (
              <div key={r.id} className="py-3 first:pt-0">
                {/* Date row */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">
                    {dow}, {fmtDateLabel(r.date)}
                  </span>
                  {r.workingMinutes > 0 && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                      {fmtWorkDuration(r.workingMinutes)}
                    </span>
                  )}
                </div>
                {/* Times row */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                      <LogIn className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Check In</p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">
                        {fmtTime(r.checkIn)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                      <LogOut className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Check Out</p>
                      {r.checkOut ? (
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                          {fmtTime(r.checkOut)}
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground leading-tight">
                          Pending
                        </p>
                      )}
                    </div>
                  </div>
                  {r.lateMinutes > 0 && (
                    <span className="ml-auto text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      +{r.lateMinutes}m late
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {entries.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {entries.length} day{entries.length !== 1 ? 's' : ''} with attendance
        </p>
      )}
    </Card>
  )
}

// ── Holiday schedule table ─────────────────────────────────────────────────────

type OfficeFilter = 'ALL' | 'BD' | 'UK'

const OFFICE_FILTER_OPTS: { value: OfficeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BD', label: 'BD' },
  { value: 'UK', label: 'UK' },
]

const OFFICE_BADGE: Record<string, string> = {
  BD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  UK: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
}

function HolidaySchedule() {
  const year = new Date().getFullYear()
  const [filter, setFilter] = useState<OfficeFilter>('ALL')
  const { data: holidays = [], isLoading } = useHolidays(year)

  const filtered =
    filter === 'ALL' ? holidays : holidays.filter((h: Holiday) => h.office?.code === filter)

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Holiday Schedule {year}</p>
        </div>
        {/* BD / UK / All filter */}
        <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
          {OFFICE_FILTER_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No holidays found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4">Sl.</th>
                <th className="pb-2 pr-4">Date of Holiday</th>
                <th className="pb-2 pr-4">Day</th>
                <th className="pb-2 pr-4 text-center">Days</th>
                <th className="pb-2 pr-4">Name of Holiday</th>
                <th className="pb-2">Office</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h: Holiday, idx: number) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const hDate = new Date(h.date)
                hDate.setHours(0, 0, 0, 0)
                const isPast = hDate < today
                const isToday = hDate.getTime() === today.getTime()
                return (
                  <tr
                    key={h.id}
                    className={cn(
                      'border-b last:border-0 transition-colors hover:bg-muted/40',
                      isPast && 'opacity-50',
                      isToday && 'bg-violet-50/60 dark:bg-violet-500/10'
                    )}
                  >
                    <td className="py-2.5 pr-4 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5 pr-4 font-medium tabular-nums">
                      {fmtHolidayDate(h.date)}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtWeekday(h.date)}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                        1
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{h.name}</span>
                      {isToday && (
                        <span className="ml-2 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                          today
                        </span>
                      )}
                      {h.isRecurring && (
                        <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          recurring
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                          OFFICE_BADGE[h.office?.code] ?? 'bg-muted text-muted-foreground'
                        )}
                      >
                        {h.office?.code ?? '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {filtered.length} holiday{filtered.length !== 1 ? 's' : ''} in {year}
        {filter !== 'ALL' && ` · ${filter} office`}
      </p>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { data: records = [] } = useMyMonthAttendance(month, year)

  const present = records.filter((r: AttendanceRecord) => r.status === 'PRESENT').length
  const late = records.filter((r: AttendanceRecord) => r.status === 'LATE').length
  const absent = records.filter((r: AttendanceRecord) => r.status === 'ABSENT').length
  const totalHrs = records.reduce((s: number, r: AttendanceRecord) => s + r.workingMinutes, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Your monthly overview, daily check-in/out and holiday schedule
        </p>
      </div>

      {/* Row 1: Today card + Check-in/out history — equal height via CSS grid stretch */}
      <div className="grid gap-4 md:grid-cols-2 items-stretch">
        <TodayCard />
        <CheckInOutHistory />
      </div>

      {/* Row 2: Month stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Present', value: present, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Late', value: late, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Absent', value: absent, cls: 'text-red-600 dark:text-red-400' },
          { label: 'Total hours', value: fmtMinutes(totalHrs), cls: 'text-primary' },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col items-center justify-center py-4">
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Row 3: Attendance calendar with hover popups */}
      <AttendanceCalendar />

      {/* Row 4: Holiday schedule */}
      <HolidaySchedule />
    </div>
  )
}
