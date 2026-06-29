'use client'

import { useState } from 'react'
import {
  usePendingApprovals,
  useApproveLeave,
  useRejectLeave,
  useApproveCancelLeave,
  useRejectCancelLeave,
} from '@/lib/api/hooks/useLeave'
import type { LeaveApplication } from '@/lib/api/hooks/useLeave'
import { Card, Avatar, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { CalendarDays, CheckCircle2, XCircle, Clock, Undo2 } from 'lucide-react'

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

type ModalState =
  | { type: 'reject'; id: string }
  | { type: 'reject-cancel'; id: string }
  | null

export default function ApprovalsPage() {
  const { data: allApps = [], isLoading } = usePendingApprovals()
  const approve = useApproveLeave()
  const reject = useRejectLeave()
  const approveCancel = useApproveCancelLeave()
  const rejectCancel = useRejectCancelLeave()

  const [modal, setModal] = useState<ModalState>(null)
  const [reason, setReason] = useState('')

  const pendingNew = (allApps as LeaveApplication[]).filter(a => a.status === 'PENDING')
  const pendingCancel = (allApps as LeaveApplication[]).filter(a => a.status === 'CANCEL_REQUESTED')

  async function handleApprove(id: string) {
    await approve.mutateAsync({ id })
  }

  async function handleApproveCancel(id: string) {
    await approveCancel.mutateAsync(id)
  }

  async function handleModalSubmit() {
    if (!modal || !reason.trim()) return
    if (modal.type === 'reject') {
      await reject.mutateAsync({ id: modal.id, rejectionReason: reason })
    } else {
      await rejectCancel.mutateAsync({ id: modal.id, reason })
    }
    setModal(null)
    setReason('')
  }

  const isEmpty = !isLoading && pendingNew.length === 0 && pendingCancel.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pending Approvals</h1>
        <p className="text-sm text-muted-foreground">Leave requests and cancellations awaiting your action</p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isEmpty ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500/60" />
          <p className="font-medium">All caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">No leave requests pending your approval.</p>
        </Card>
      ) : (
        <>
          {/* New leave requests */}
          {pendingNew.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                New requests · {pendingNew.length}
              </h2>
              {pendingNew.map(app => (
                <LeaveCard
                  key={app.id}
                  app={app}
                  primaryAction={{ label: 'Approve', icon: CheckCircle2, color: 'emerald', onClick: () => handleApprove(app.id), loading: approve.isPending }}
                  secondaryAction={{ label: 'Reject', icon: XCircle, onClick: () => { setModal({ type: 'reject', id: app.id }); setReason('') } }}
                />
              ))}
            </div>
          )}

          {/* Cancellation requests */}
          {pendingCancel.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Cancellation requests · {pendingCancel.length}
              </h2>
              {pendingCancel.map(app => (
                <LeaveCard
                  key={app.id}
                  app={app}
                  cancelNote={app.cancelReason ?? undefined}
                  primaryAction={{ label: 'Approve Cancel', icon: CheckCircle2, color: 'orange', onClick: () => handleApproveCancel(app.id), loading: approveCancel.isPending }}
                  secondaryAction={{ label: 'Keep Leave', icon: XCircle, onClick: () => { setModal({ type: 'reject-cancel', id: app.id }); setReason('') } }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Shared reason modal (reject / reject-cancel) */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="mb-3 font-semibold">
              {modal.type === 'reject' ? 'Rejection reason' : 'Reason for keeping leave'}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {modal.type === 'reject'
                ? 'Provide a reason for rejecting this leave request.'
                : 'Explain why the cancellation request is being denied and the leave will remain active.'}
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder={modal.type === 'reject' ? 'Reason for rejection…' : 'Reason for denying cancellation…'}
              autoFocus
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={!reason.trim() || reject.isPending || rejectCancel.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {reject.isPending || rejectCancel.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeaveCard({
  app,
  cancelNote,
  primaryAction,
  secondaryAction,
}: {
  app: LeaveApplication
  cancelNote?: string
  primaryAction: { label: string; icon: React.ElementType; color: 'emerald' | 'orange'; onClick: () => void; loading: boolean }
  secondaryAction: { label: string; icon: React.ElementType; onClick: () => void }
}) {
  const PrimaryIcon = primaryAction.icon
  const SecondaryIcon = secondaryAction.icon
  const primaryCls = primaryAction.color === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-orange-600 hover:bg-orange-700'

  return (
    <Card>
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
          {cancelNote && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 dark:border-orange-800/40 dark:bg-orange-500/10">
              <Undo2 className="mt-0.5 h-3 w-3 shrink-0 text-orange-600 dark:text-orange-400" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <span className="font-medium">Cancel reason:</span> {cancelNote}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={primaryAction.onClick}
            disabled={primaryAction.loading}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50', primaryCls)}
          >
            <PrimaryIcon className="h-3.5 w-3.5" />
            {primaryAction.label}
          </button>
          <button
            onClick={secondaryAction.onClick}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-destructive/10 hover:text-destructive"
          >
            <SecondaryIcon className="h-3.5 w-3.5" />
            {secondaryAction.label}
          </button>
        </div>
      </div>
    </Card>
  )
}
