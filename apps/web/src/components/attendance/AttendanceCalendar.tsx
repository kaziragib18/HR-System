'use client'

import { useState, useRef } from 'react'
import {
  useAttendanceCalendar,
  useSubmitLateExcuse,
  type CalendarRecord,
  type CalendarLeave,
} from '@/lib/api/hooks/useAttendance'
import { Card, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Mon-first week
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const STATUS_CELL: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  LATE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  ON_LEAVE: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  HOLIDAY: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  HALF_DAY: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  EARLY_DEPARTURE: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  WEEKEND: 'text-muted-foreground/30',
}

function fmtTimeLocal(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtMins(m: number): string {
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Convert "HH:mm" (24h) to "h:mm AM/PM" */
function fmtHHmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sd = `${s.getUTCDate()} ${MONTHS_SHORT[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${MONTHS_SHORT[e.getUTCMonth()]}`
}

interface DayInfo {
  day: number
  date: string
  record: CalendarRecord | undefined
  leave: CalendarLeave | undefined
  officeStartTime: string
  officeEndTime: string
  isWeekend: boolean
  isFuture: boolean
}

function ExcuseStatusIcon({ status }: { status: string | null }) {
  if (status === 'APPROVED') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === 'REJECTED') return <XCircle className="h-3.5 w-3.5 text-red-500" />
  if (status === 'PENDING') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  return null
}

function DayDetailPanel({
  info,
  onExcuseSubmitted,
}: {
  info: DayInfo
  onExcuseSubmitted: () => void
}) {
  const [showExcuseForm, setShowExcuseForm] = useState(false)
  const [excuse, setExcuse] = useState('')
  const submitExcuse = useSubmitLateExcuse()

  const { record, leave, officeStartTime, officeEndTime, isWeekend, isFuture } = info
  const dateLabel = new Date(info.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  async function handleSubmitExcuse() {
    if (!record || !excuse.trim()) return
    await submitExcuse.mutateAsync({ id: record.id, excuse: excuse.trim() })
    setShowExcuseForm(false)
    setExcuse('')
    onExcuseSubmitted()
  }

  const canSubmitExcuse =
    record &&
    (record.status === 'LATE' || record.status === 'HALF_DAY') &&
    record.lateMinutes > 30 &&
    !record.excuseStatus

  return (
    <div className="text-sm">
      <p className="mb-2 font-medium text-card-foreground">{dateLabel}</p>

      {isWeekend && (
        <p className="text-muted-foreground text-xs">Weekend — office closed (Sat/Sun)</p>
      )}

      {!isWeekend && isFuture && <p className="text-muted-foreground text-xs">No data yet.</p>}

      {!isWeekend && !isFuture && !record && !leave && (
        <p className="text-muted-foreground text-xs">No attendance record.</p>
      )}

      {record && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            {(() => {
              const ds =
                record.status === 'HALF_DAY'
                  ? 'LATE'
                  : record.status === 'EARLY_DEPARTURE'
                    ? 'PRESENT'
                    : record.status
              return (
                <span
                  className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_CELL[ds])}
                >
                  {ds.replace(/_/g, ' ')}
                </span>
              )
            })()}
            {record.excuseStatus && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <ExcuseStatusIcon status={record.excuseStatus} />
                Excuse {record.excuseStatus.toLowerCase()}
              </span>
            )}
          </div>

          {record.checkIn && (
            <div className="flex justify-between text-muted-foreground">
              <span>Check-in</span>
              <span
                className={cn(
                  'font-medium',
                  record.lateMinutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                )}
              >
                {fmtTimeLocal(record.checkIn)}
              </span>
            </div>
          )}
          {record.checkOut && (
            <div className="flex justify-between text-muted-foreground">
              <span>Check-out</span>
              <span className="font-medium text-foreground">{fmtTimeLocal(record.checkOut)}</span>
            </div>
          )}
          {record.workingMinutes > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Hours worked</span>
              <span className="font-medium text-foreground">{fmtMins(record.workingMinutes)}</span>
            </div>
          )}

          {(record.status === 'LATE' || record.status === 'HALF_DAY') && record.lateMinutes > 0 && (
            <>
              <div className="border-t pt-1.5 flex justify-between text-muted-foreground">
                <span>Office hours</span>
                <span className="font-medium text-foreground">
                  {fmtHHmm(officeStartTime)} – {fmtHHmm(officeEndTime)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Late by</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {fmtMins(record.lateMinutes)}
                </span>
              </div>

              {record.lateExcuse && (
                <div className="mt-1 rounded bg-muted p-2 text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Reason submitted</p>
                  <p>{record.lateExcuse}</p>
                </div>
              )}

              {canSubmitExcuse && !showExcuseForm && (
                <button
                  onClick={() => setShowExcuseForm(true)}
                  className="mt-1 w-full rounded-md bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  Submit reason to manager
                </button>
              )}

              {showExcuseForm && (
                <div className="mt-1 space-y-2">
                  <textarea
                    value={excuse}
                    onChange={(e) => setExcuse(e.target.value)}
                    placeholder="Explain why you were late…"
                    rows={3}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitExcuse}
                      disabled={!excuse.trim() || submitExcuse.isPending}
                      className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {submitExcuse.isPending ? 'Sending…' : 'Send'}
                    </button>
                    <button
                      onClick={() => {
                        setShowExcuseForm(false)
                        setExcuse('')
                      }}
                      className="rounded-md border px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {leave && (
        <div
          className={cn(
            'mt-2 rounded-md border-l-2 pl-2 py-1 text-xs space-y-0.5',
            leave.status === 'APPROVED'
              ? 'border-emerald-500'
              : leave.status === 'REJECTED'
                ? 'border-red-500'
                : 'border-amber-500'
          )}
        >
          <p className="font-medium">{leave.type}</p>
          <p className="text-muted-foreground">
            {leave.status} · {fmtRange(leave.startDate, leave.endDate)}
          </p>
          {leave.reason && <p className="text-muted-foreground italic">{leave.reason}</p>}
        </div>
      )}
    </div>
  )
}

export function AttendanceCalendar({ className }: { className?: string }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [tooltip, setTooltip] = useState<{ info: DayInfo; rect: DOMRect } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openTooltip(info: DayInfo, e: React.MouseEvent<HTMLDivElement>) {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setTooltip({ info, rect: e.currentTarget.getBoundingClientRect() })
  }
  function startClose() {
    closeTimer.current = setTimeout(() => setTooltip(null), 150)
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  const { data: calData, isLoading } = useAttendanceCalendar(month, year)

  const recordByDate: Record<string, CalendarRecord> = {}
  calData?.records.forEach((r) => { recordByDate[r.date] = r })

  const leaveByDate: Record<string, CalendarLeave> = {}
  calData?.leaves.forEach((leave) => {
    const cur = new Date(leave.startDate)
    const end = new Date(leave.endDate)
    while (cur <= end) {
      leaveByDate[cur.toISOString().slice(0, 10)] = leave
      cur.setDate(cur.getDate() + 1)
    }
  })

  const officeStart = calData?.officeStartTime ?? '09:00'
  const officeEnd = calData?.officeEndTime ?? '17:00'

  const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1)
    setTooltip(null)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1)
    setTooltip(null)
  }

  const legend = [
    { label: 'Present', cls: STATUS_CELL.PRESENT },
    { label: 'Late', cls: STATUS_CELL.LATE },
    { label: 'Absent', cls: STATUS_CELL.ABSENT },
    { label: 'Leave', cls: STATUS_CELL.ON_LEAVE },
    { label: 'Holiday', cls: STATUS_CELL.HOLIDAY },
    { label: 'Weekend', cls: 'bg-rose-50/60 dark:bg-rose-950/10 text-muted-foreground/60' },
  ]

  return (
    <Card className={className}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded p-1 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[140px] text-center text-sm font-semibold">
            {MONTHS_FULL[month - 1]} {year}
          </p>
          <button onClick={nextMonth} className="rounded p-1 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
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

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  'py-1 text-center text-[10px] font-semibold',
                  i >= 5 ? 'text-rose-500/70 dark:text-rose-400/60' : 'text-muted-foreground'
                )}
              >
                {w}
              </div>
            ))}

            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - firstDayOffset + 1
              if (day < 1 || day > daysInMonth) return <div key={i} />

              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dow = new Date(year, month - 1, day).getDay()
              const isWeekend = dow === 0 || dow === 6

              const record = recordByDate[dateStr]
              const leave = leaveByDate[dateStr]
              const isToday =
                dateStr ===
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
              const isFuture = new Date(dateStr) > now

              const rawStatus = record?.status
              const displayStatus = isWeekend
                ? null
                : rawStatus === 'HALF_DAY'
                  ? 'LATE'
                  : rawStatus === 'EARLY_DEPARTURE'
                    ? 'PRESENT'
                    : rawStatus

              const cellCls = isWeekend
                ? 'bg-rose-50/80 dark:bg-rose-500/10 text-muted-foreground/40 dark:text-muted-foreground/30'
                : displayStatus
                  ? (STATUS_CELL[displayStatus] ?? 'text-foreground')
                  : !isFuture
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                    : 'text-muted-foreground/40'

              const info: DayInfo = {
                day,
                date: dateStr,
                record: isWeekend ? undefined : record,
                leave: isWeekend ? undefined : leave,
                officeStartTime: officeStart,
                officeEndTime: officeEnd,
                isWeekend,
                isFuture,
              }

              const isActive = tooltip?.info.date === dateStr

              return (
                <div
                  key={i}
                  onMouseEnter={(e) => openTooltip(info, e)}
                  onMouseLeave={startClose}
                  className={cn(
                    'flex h-9 cursor-default items-center justify-center rounded-md text-xs font-medium transition-colors',
                    cellCls,
                    isToday && !isWeekend && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                    isActive && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background',
                    !isWeekend && leave && !rawStatus && 'bg-blue-50 dark:bg-blue-500/15'
                  )}
                >
                  {day}
                </div>
              )
            })}
          </div>

          {/* Floating popup */}
          {tooltip &&
            (() => {
              const { rect, info } = tooltip
              const PW = 288
              const above = rect.top > 250
              const popupTop = above ? rect.top - 8 : rect.bottom + 8
              const popupLeft = Math.max(
                8,
                Math.min(rect.left + rect.width / 2 - PW / 2, window.innerWidth - PW - 8)
              )
              return (
                <div
                  style={{
                    position: 'fixed',
                    top: popupTop,
                    left: popupLeft,
                    width: PW,
                    transform: above ? 'translateY(-100%)' : 'none',
                    zIndex: 9999,
                  }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={startClose}
                  className="rounded-xl border bg-card p-3 shadow-xl"
                >
                  <DayDetailPanel
                    key={info.date}
                    info={info}
                    onExcuseSubmitted={() => setTooltip(null)}
                  />
                </div>
              )
            })()}
        </>
      )}
    </Card>
  )
}
