'use client'

import { useState } from 'react'
import { usePendingApprovals, useApproveLeave, useRejectLeave } from '@/lib/api/hooks/useLeave'
import type { LeaveApplication } from '@/lib/api/hooks/useLeave'
import { Card, Avatar, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { CalendarDays, CheckCircle2, XCircle, Clock } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sd = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ApprovalsPage() {
  const { data: applicationsRaw = [], isLoading } = usePendingApprovals()
  const applications = applicationsRaw as LeaveApplication[]
  const approve = useApproveLeave()
  const reject = useRejectLeave()

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function handleApprove(id: string) {
    await approve.mutateAsync({ id })
  }

  async function handleReject() {
    if (!rejectId || !rejectReason.trim()) return
    await reject.mutateAsync({ id: rejectId, rejectionReason: rejectReason })
    setRejectId(null)
    setRejectReason('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pending Approvals</h1>
        <p className="text-sm text-muted-foreground">Leave requests awaiting your action</p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : applications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500/60" />
          <p className="font-medium">All caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">No leave requests pending your approval.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map(app => (
            <Card key={app.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Employee info */}
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={app.employee?.firstName ?? '?'}
                    lastName={app.employee?.lastName ?? '?'}
                    url={app.employee?.avatarUrl}
                    size={40}
                  />
                  <div>
                    <p className="font-medium">
                      {app.employee?.firstName} {app.employee?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{app.employee?.employeeId}</p>
                  </div>
                </div>

                {/* Leave details */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {app.leaveType?.name}
                    </span>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {fmtRange(app.startDate, app.endDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Number(app.totalDays)} day{Number(app.totalDays) > 1 ? 's' : ''}
                    </span>
                    <span>Applied {fmtDate(app.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={approve.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => { setRejectId(app.id); setRejectReason('') }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject reason dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="mb-3 font-semibold">Rejection reason</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Provide a reason for rejection…"
              autoFocus
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || reject.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
