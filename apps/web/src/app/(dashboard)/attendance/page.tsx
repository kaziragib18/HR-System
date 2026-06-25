'use client'

import { useState } from 'react'
import { useTodayAttendance, useMyMonthAttendance, useCheckIn, useCheckOut, type AttendanceRecord } from '@/lib/api/hooks/useAttendance'
import { Card, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { LogIn, LogOut, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtMinutes(mins: number): string {
  if (!mins) return '—'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function AttendancePage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: today, isLoading: todayLoading } = useTodayAttendance()
  const { data: records = [], isLoading: monthLoading } = useMyMonthAttendance(month, year)
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()

  const statusByDay: Record<number, string> = {}
  records.forEach((r: AttendanceRecord) => {
    const d = parseInt(r.date.slice(8, 10), 10)
    statusByDay[d] = r.status
  })

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const todayDate = now.getDate()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  // Stats
  const present = records.filter((r: AttendanceRecord) => r.status === 'PRESENT').length
  const late = records.filter((r: AttendanceRecord) => r.status === 'LATE').length
  const absent = records.filter((r: AttendanceRecord) => r.status === 'ABSENT').length
  const totalHrs = records.reduce((s: number, r: AttendanceRecord) => s + r.workingMinutes, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Your monthly attendance overview and daily check-in/out</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's Status Card */}
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>
          {todayLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={today?.status ?? 'ABSENT'} />
                <span className="text-xs text-muted-foreground">
                  {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Check-in" icon={<LogIn className="h-3.5 w-3.5" />}>
                  <span className={cn('font-medium', today?.checkIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {fmtTime(today?.checkIn ?? null)}
                  </span>
                </Row>
                <Row label="Check-out" icon={<LogOut className="h-3.5 w-3.5" />}>
                  <span className="font-medium">{today?.checkOut ? fmtTime(today.checkOut) : <span className="text-muted-foreground">Pending</span>}</span>
                </Row>
                <Row label="Hours worked" icon={<Clock className="h-3.5 w-3.5" />}>
                  <span className="font-medium">{fmtMinutes(today?.workingMinutes ?? 0)}</span>
                </Row>
                {(today?.lateMinutes ?? 0) > 0 && (
                  <Row label="Late by" icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />}>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{today!.lateMinutes} min</span>
                  </Row>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => checkIn.mutate(undefined)}
                  disabled={checkIn.isPending || !!today?.checkIn}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  {checkIn.isPending ? 'Checking in…' : today?.checkIn ? 'Checked in' : 'Check In'}
                </button>
                <button
                  onClick={() => checkOut.mutate(undefined)}
                  disabled={checkOut.isPending || !today?.checkIn || !!today?.checkOut}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {checkOut.isPending ? 'Checking out…' : today?.checkOut ? 'Checked out' : 'Check Out'}
                </button>
              </div>

              {checkIn.isSuccess && !today?.checkIn && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Checked in successfully
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Month Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Present', value: present, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Late', value: late, cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'Absent', value: absent, cls: 'text-red-600 dark:text-red-400' },
            { label: 'Total hours', value: fmtMinutes(totalHrs), cls: 'text-primary' },
          ].map(s => (
            <Card key={s.label} className="flex flex-col items-center justify-center py-4">
              <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Monthly Calendar */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {MONTHS[month - 1]} {year} attendance
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
              }}
              className="rounded px-2 py-1 text-xs hover:bg-muted"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => {
                if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
              }}
              disabled={isCurrentMonth}
              className="rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        </div>

        {monthLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="py-1 text-center text-[10px] font-medium text-muted-foreground">{w}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />
              const status = statusByDay[day]
              const dow = new Date(year, month - 1, day).getDay()
              const isWeekend = dow === 0 || dow === 6
              const isToday = isCurrentMonth && day === todayDate
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
                  title={status ?? (isWeekend ? 'Weekend' : '')}
                >
                  {day}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { label: 'Present', cls: 'st-present' },
            { label: 'Late', cls: 'st-late' },
            { label: 'Absent', cls: 'st-absent' },
            { label: 'On Leave', cls: 'st-on_leave' },
            { label: 'Holiday', cls: 'st-holiday' },
          ].map(l => (
            <span key={l.label} className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', l.cls)}>
              {l.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Row({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      {children}
    </div>
  )
}
