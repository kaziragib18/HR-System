'use client'

import Link from 'next/link'
import { useLeaveBalances, useMyLeaveApplications, useCancelLeave, type LeaveApplication, type LeaveBalance } from '@/lib/api/hooks/useLeave'
import { Card, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { Plus, CalendarDays, Coins } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LEAVE_COLORS: Record<string, string> = {
  AL: 'bg-blue-500',
  SL: 'bg-emerald-500',
  CL: 'bg-amber-500',
  ML: 'bg-rose-500',
  UL: 'bg-slate-500',
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sd = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`
}

export default function LeavePage() {
  const year = new Date().getFullYear()
  const { data: balances = [], isLoading: balLoading } = useLeaveBalances(year)
  const { data: applications = [], isLoading: appLoading } = useMyLeaveApplications()
  const cancel = useCancelLeave()

  const canCancel = (app: LeaveApplication) =>
    app.status === 'PENDING' || app.status === 'APPROVED'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Leave</h1>
          <p className="text-sm text-muted-foreground">Balances, applications and history</p>
        </div>
        <Link
          href="/leave/apply"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Apply for Leave
        </Link>
      </div>

      {/* Leave Balances */}
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Leave balance · {year}
        </p>
        {balLoading ? (
          <Spinner />
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave balances configured.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            {balances.map((b: LeaveBalance) => {
              const entitled = Number(b.entitled)
              const taken = Number(b.taken)
              const pending = Number(b.pending)
              const remaining = entitled - taken - pending
              const pct = entitled > 0 ? Math.min(100, ((taken + pending) / entitled) * 100) : 0
              const color = LEAVE_COLORS[b.leaveType.code] ?? 'bg-primary'
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{b.leaveType.name}</span>
                    <span className="text-muted-foreground">
                      {taken + pending} / {entitled}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{remaining} remaining</span>
                    {pending > 0 && <span className="text-amber-600 dark:text-amber-400">{pending} pending</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Annual leave encashment available — contact HR for details
        </div>
      </Card>

      {/* Applications List */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            My applications
          </p>
          <Link href="/leave/apply" className="flex items-center gap-1 text-xs font-medium text-primary">
            <Plus className="h-3 w-3" /> New
          </Link>
        </div>
        {appLoading ? (
          <Spinner />
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave applications yet.</p>
        ) : (
          <div className="space-y-2">
            {applications.map((app: LeaveApplication) => (
              <div
                key={app.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white',
                    LEAVE_COLORS[app.leaveType?.code ?? ''] ?? 'bg-primary'
                  )}>
                    {app.leaveType?.code ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.leaveType?.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {fmtRange(app.startDate, app.endDate)} · {Number(app.totalDays)} day{Number(app.totalDays) > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  {canCancel(app) && (
                    <button
                      onClick={() => { if (confirm('Cancel this application?')) cancel.mutate(app.id) }}
                      disabled={cancel.isPending}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
