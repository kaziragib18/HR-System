'use client'

import { useState } from 'react'
import {
  useMyTimesheets,
  useAllTimesheets,
  useGenerateTimesheet,
  useSubmitTimesheet,
  useApproveTimesheet,
  useRejectTimesheet,
  type Timesheet,
  type TimesheetEntry,
} from '@/lib/api/hooks/useTimesheets'
import { Card, StatusBadge, Spinner, Avatar } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import { Clock, TrendingUp, ChevronDown, ChevronRight, CheckCircle2, XCircle, Zap } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD]

function fmtMinutes(mins: number): string {
  if (!mins) return '—'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function weekLabel(ts: Timesheet): string {
  return `${fmtDate(ts.weekStartDate)} – ${fmtDate(ts.weekEndDate)}`
}

function EntryRow({ entry }: { entry: TimesheetEntry }) {
  const d = new Date(entry.date)
  const dow = DAYS[(d.getUTCDay() + 6) % 7]
  return (
    <div className="grid grid-cols-4 gap-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{dow}, {fmtDate(entry.date)}</span>
      <span>{fmtTime(entry.checkIn)}</span>
      <span>{fmtTime(entry.checkOut)}</span>
      <span className="font-medium">{fmtMinutes(entry.workMinutes)}</span>
    </div>
  )
}

function TimesheetRow({ ts, onSubmit }: { ts: Timesheet; onSubmit: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const submit = onSubmit

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-muted-foreground">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
          <div>
            <p className="text-sm font-medium">{weekLabel(ts)}</p>
            <p className="text-xs text-muted-foreground">{ts.entries.length} day{ts.entries.length !== 1 ? 's' : ''} logged</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-semibold">{fmtMinutes(ts.totalMinutes)}</p>
          </div>
          {ts.overtimeMinutes > 0 && (
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">OT</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{fmtMinutes(ts.overtimeMinutes)}</p>
            </div>
          )}
          <StatusBadge status={ts.status} />
          {ts.status === 'DRAFT' && (
            <button
              onClick={e => { e.stopPropagation(); submit(ts.id) }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Submit
            </button>
          )}
        </div>
      </button>

      {open && ts.entries.length > 0 && (
        <div className="border-t px-4 pb-3 pt-2">
          <div className="grid grid-cols-4 gap-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Day</span><span>Check-in</span><span>Check-out</span><span>Hours</span>
          </div>
          {ts.entries.map(e => <EntryRow key={e.id} entry={e} />)}
          {ts.rejectionReason && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Returned: {ts.rejectionReason}
            </p>
          )}
        </div>
      )}
      {open && ts.entries.length === 0 && (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">No entries recorded for this week.</p>
      )}
    </div>
  )
}

function TeamTimesheetRow({ ts }: { ts: Timesheet }) {
  const approve = useApproveTimesheet()
  const reject = useRejectTimesheet()
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function handleReject() {
    if (!rejectReason.trim()) return
    await reject.mutateAsync({ id: ts.id, rejectionReason: rejectReason })
    setShowReject(false)
    setRejectReason('')
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar
            firstName={ts.employee?.firstName ?? '?'}
            lastName={ts.employee?.lastName ?? '?'}
            size={36}
          />
          <div>
            <p className="text-sm font-medium">{ts.employee?.firstName} {ts.employee?.lastName}</p>
            <p className="text-xs text-muted-foreground">{ts.employee?.employeeId} · {weekLabel(ts)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Hours</p>
            <p className="text-sm font-semibold">{fmtMinutes(ts.totalMinutes)}</p>
          </div>
          {ts.overtimeMinutes > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">OT</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{fmtMinutes(ts.overtimeMinutes)}</p>
            </div>
          )}
          <button
            onClick={() => approve.mutate(ts.id)}
            disabled={approve.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            onClick={() => { setShowReject(true); setRejectReason('') }}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </div>

      {showReject && (
        <div className="border-t px-4 pb-3 pt-2">
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Reason for returning this timesheet…"
            autoFocus
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setShowReject(false)}
              className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || reject.isPending}
              className="flex-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
            >
              {reject.isPending ? 'Returning…' : 'Return to Employee'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TimesheetsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const user = useAuthStore(s => s.user)
  const isManager = user ? MANAGER_ROLES.includes(user.role) : false

  const { data: timesheets = [], isLoading } = useMyTimesheets(month, year)
  const { data: teamTimesheets = [], isLoading: teamLoading } = useAllTimesheets(
    isManager ? { status: 'SUBMITTED' } : undefined
  )
  const generate = useGenerateTimesheet()
  const submit = useSubmitTimesheet()

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const totalMins = timesheets.reduce((s: number, t: Timesheet) => s + t.totalMinutes, 0)
  const overtimeMins = timesheets.reduce((s: number, t: Timesheet) => s + t.overtimeMinutes, 0)
  const submitted = timesheets.filter((t: Timesheet) => t.status === 'SUBMITTED').length
  const approved = timesheets.filter((t: Timesheet) => t.status === 'APPROVED').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Timesheets</h1>
          <p className="text-sm text-muted-foreground">Weekly time records and approvals</p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          {generate.isPending ? 'Generating…' : 'Generate This Week'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total hours', value: fmtMinutes(totalMins), icon: <Clock className="h-4 w-4" />, cls: 'text-primary' },
          { label: 'Overtime', value: fmtMinutes(overtimeMins), icon: <TrendingUp className="h-4 w-4" />, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Submitted', value: submitted, icon: null, cls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Approved', value: approved, icon: null, cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="flex flex-col items-center justify-center py-4">
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* My Timesheets */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {MONTHS[month - 1]} {year}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
              className="rounded px-2 py-1 text-xs hover:bg-muted"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
              disabled={isCurrentMonth}
              className="rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : timesheets.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground">No timesheets for this month.</p>
            <p className="mt-1 text-xs text-muted-foreground">Use "Generate This Week" to create one from your attendance.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timesheets.map((ts: Timesheet) => (
              <TimesheetRow
                key={ts.id}
                ts={ts}
                onSubmit={(id) => submit.mutate(id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Manager: Pending Reviews */}
      {isManager && (
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending reviews {(teamTimesheets as Timesheet[]).length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {(teamTimesheets as Timesheet[]).length}
              </span>
            )}
          </p>
          {teamLoading ? (
            <Spinner />
          ) : (teamTimesheets as Timesheet[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/60" />
              <p className="text-sm text-muted-foreground">No timesheets pending review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(teamTimesheets as Timesheet[]).map(ts => (
                <TeamTimesheetRow key={ts.id} ts={ts} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
