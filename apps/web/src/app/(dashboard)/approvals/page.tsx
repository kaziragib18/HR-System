'use client'

import { useState } from 'react'
import {
  usePendingApprovals,
  useApproveLeave,
  useRejectLeave,
  useApproveCancelLeave,
  useRejectCancelLeave,
} from '@/lib/api/hooks/useLeave'
import type { LeaveApplication, LeaveApprovalHistory } from '@/lib/api/hooks/useLeave'
import { usePendingExcuses, useReviewExcuse, usePendingAdjustments, useReviewAdjustment } from '@/lib/api/hooks/useAttendance'
import type { AttendanceRecord } from '@/lib/api/hooks/useAttendance'
import { useApprovalHistory } from '@/lib/api/hooks/useApprovalHistory'
import type { ApprovalHistoryItem } from '@/lib/api/hooks/useApprovalHistory'
import { Avatar, StatusBadge, Spinner, PageHeader, RolePill } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Undo2,
  AlertCircle, Building2, History,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtDateRange(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  const sd = `${s.getUTCDate()} ${SHORT_MONTHS[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${SHORT_MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function EmployeeRow({ firstName, lastName, employeeId, avatarUrl, department, role }: {
  firstName: string; lastName: string; employeeId: string
  avatarUrl?: string | null; department?: { name: string } | null; role?: string | null
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar firstName={firstName} lastName={lastName} url={avatarUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-tight truncate">{firstName} {lastName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground">{employeeId}</span>
          {department && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />{department.name}
            </span>
          )}
          {role && <RolePill role={role} />}
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-border" />
}

function MetaChip({ icon: Icon, children, className }: {
  icon: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      {children}
    </span>
  )
}

function ApprovalChain({ history }: { history: LeaveApprovalHistory[] }) {
  const [open, setOpen] = useState(false)
  if (!history.length) return null

  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Approval history · {history.length} step{history.length !== 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <>
          <Divider />
          <div className="space-y-0 divide-y divide-border">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className={cn(
                  'shrink-0 w-12 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold',
                  h.action === 'APPROVED'  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : h.action === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                )}>
                  L{h.level}
                </span>
                <span className="flex-1 text-xs">
                  <span className="font-medium text-foreground">
                    {h.action.charAt(0) + h.action.slice(1).toLowerCase()}
                  </span>
                  {h.approver && (
                    <span className="text-muted-foreground"> by {h.approver.firstName} {h.approver.lastName}</span>
                  )}
                  {h.comment && (
                    <span className="block text-muted-foreground mt-0.5">"{h.comment}"</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {children}
    </div>
  )
}

function ApproveBtn({ onClick, disabled, label, variant = 'green' }: {
  onClick: () => void; disabled: boolean; label: string
  variant?: 'green' | 'orange'
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50',
        variant === 'green' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'
      )}
    >
      <CheckCircle2 className="h-4 w-4" />
      {disabled ? '…' : label}
    </button>
  )
}

function RejectBtn({ onClick, label = 'Reject' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
    >
      <XCircle className="h-4 w-4" />
      {label}
    </button>
  )
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function TabBtn({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none',
          active ? 'bg-primary text-primary-foreground' : 'bg-destructive/15 text-destructive'
        )}>
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'reject-leave'; id: string }
  | { type: 'reject-cancel'; id: string }
  | { type: 'reject-excuse'; id: string }
  | { type: 'approve-excuse'; id: string }
  | { type: 'reject-adjustment'; id: string }
  | { type: 'approve-adjustment'; id: string }
  | null

function ReasonModal({ title, description, placeholder, submitting, onSubmit, onClose }: {
  title: string; description: string; placeholder: string
  submitting: boolean; onSubmit: (reason: string) => void; onClose: () => void
}) {
  const [val, setVal] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold text-base">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <textarea
          autoFocus value={val} onChange={e => setVal(e.target.value)} rows={3}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(val)}
            disabled={!val.trim() || submitting}
            className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ title, description, confirmLabel, confirmCls, submitting, onConfirm, onClose }: {
  title: string; description: string; confirmLabel: string; confirmCls: string
  submitting: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={submitting}
            className={cn('flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50', confirmCls)}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Leave section ────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>
    </div>
  )
}

function LeaveCard({ app, onApprove, onReject, approveLabel, approveVariant, approving, cancelNote }: {
  app: LeaveApplication
  onApprove: () => void; onReject: () => void
  approveLabel: string; approveVariant: 'green' | 'orange'
  approving: boolean; cancelNote?: string
}) {
  const emp = app.employee

  return (
    <div className={cn(
      'overflow-hidden rounded-xl border bg-card shadow-sm',
      'border-l-[3px]',
      approveVariant === 'orange' ? 'border-l-orange-500' : 'border-l-blue-500'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        {emp && (
          <EmployeeRow
            firstName={emp.firstName} lastName={emp.lastName}
            employeeId={emp.employeeId} avatarUrl={emp.avatarUrl}
            department={emp.department} role={emp.user?.role}
          />
        )}
        <div className="shrink-0 pt-0.5">
          <StatusBadge status={app.status} />
        </div>
      </div>

      <Divider />

      {/* Body */}
      <div className="space-y-3 px-5 py-4">
        {/* Leave type + key stats */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            <CalendarDays className="h-3.5 w-3.5" />
            {app.leaveType?.name}
          </span>
          <MetaChip icon={CalendarDays}>{fmtDateRange(app.startDate, app.endDate)}</MetaChip>
          <span className="text-sm font-semibold tabular-nums">
            {Number(app.totalDays)} <span className="text-xs font-normal text-muted-foreground">day{Number(app.totalDays) !== 1 ? 's' : ''}</span>
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Applied {fmtDate(app.createdAt)}</span>
        </div>

        {/* Reason */}
        {app.reason && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Reason: </span>{app.reason}
          </p>
        )}

        {/* Cancel note */}
        {cancelNote && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-800/30 dark:bg-orange-500/10">
            <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-orange-700 dark:text-orange-300">
              <span className="font-medium">Cancel reason: </span>{cancelNote}
            </p>
          </div>
        )}

        {/* Approval chain */}
        {app.approvalHistory && app.approvalHistory.length > 0 && (
          <ApprovalChain history={app.approvalHistory} />
        )}
      </div>

      <Divider />

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 px-5 py-3">
        <RejectBtn onClick={onReject} label={approveVariant === 'orange' ? 'Keep Leave' : 'Reject'} />
        <ApproveBtn onClick={onApprove} disabled={approving} label={approveLabel} variant={approveVariant} />
      </div>
    </div>
  )
}

function LeaveSection({ onModal }: { onModal: (m: ModalState) => void }) {
  const { data: apps = [], isLoading } = usePendingApprovals()
  const approve       = useApproveLeave()
  const approveCancel = useApproveCancelLeave()

  const pending   = (apps as LeaveApplication[]).filter(a => a.status === 'PENDING')
  const cancelReq = (apps as LeaveApplication[]).filter(a => a.status === 'CANCEL_REQUESTED')

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!pending.length && !cancelReq.length) return <Empty icon={CalendarDays} message="No leave requests pending approval." />

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="New requests" count={pending.length} />
          {pending.map(app => (
            <LeaveCard key={app.id} app={app}
              onApprove={() => approve.mutateAsync({ id: app.id })}
              onReject={() => onModal({ type: 'reject-leave', id: app.id })}
              approveLabel="Approve" approveVariant="green"
              approving={approve.isPending}
            />
          ))}
        </div>
      )}
      {cancelReq.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="Cancellation requests" count={cancelReq.length} />
          {cancelReq.map(app => (
            <LeaveCard key={app.id} app={app}
              onApprove={() => approveCancel.mutateAsync(app.id)}
              onReject={() => onModal({ type: 'reject-cancel', id: app.id })}
              approveLabel="Approve Cancel" approveVariant="orange"
              approving={approveCancel.isPending}
              cancelNote={app.cancelReason ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Late excuses section ─────────────────────────────────────────────────────

function ExcuseCard({ rec, onApprove, onReject, reviewing }: {
  rec: AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> }
  onApprove: () => void; onReject: () => void; reviewing: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-l-[3px] border-l-amber-500 bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <EmployeeRow
          firstName={rec.employee.firstName} lastName={rec.employee.lastName}
          employeeId={rec.employee.employeeId} avatarUrl={rec.employee.avatarUrl}
          department={rec.employee.department} role={rec.employee.user?.role}
        />
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {(rec.lateMinutes ?? 0)}m late
        </span>
      </div>

      <Divider />

      {/* Body */}
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <MetaChip icon={CalendarDays}>{fmtDate(rec.date)}</MetaChip>
          {rec.checkIn && (
            <MetaChip icon={Clock}>
              Checked in {fmtTime(rec.checkIn)}
            </MetaChip>
          )}
        </div>
        {rec.lateExcuse && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Excuse: </span>{rec.lateExcuse}
          </p>
        )}
      </div>

      <Divider />

      <div className="flex items-center justify-end gap-2 px-5 py-3">
        <RejectBtn onClick={onReject} />
        <ApproveBtn onClick={onApprove} disabled={reviewing} label="Approve" variant="green" />
      </div>
    </div>
  )
}

function ExcusesSection({ onModal }: { onModal: (m: ModalState) => void }) {
  const { data: excuses = [], isLoading } = usePendingExcuses()
  const review = useReviewExcuse()

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!excuses.length) return <Empty icon={Clock} message="No late excuses pending review." />

  return (
    <div className="space-y-3">
      <SectionLabel label="Late arrival excuses" count={excuses.length} />
      {(excuses as (AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> })[]).map(rec => (
        <ExcuseCard key={rec.id} rec={rec}
          onApprove={() => onModal({ type: 'approve-excuse', id: rec.id })}
          onReject={() => onModal({ type: 'reject-excuse', id: rec.id })}
          reviewing={review.isPending}
        />
      ))}
    </div>
  )
}

// ─── Adjustment requests section ──────────────────────────────────────────────

function AdjustmentCard({ rec, onApprove, onReject, reviewing }: {
  rec: AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> }
  onApprove: () => void; onReject: () => void; reviewing: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-l-[3px] border-l-orange-500 bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <EmployeeRow
          firstName={rec.employee.firstName} lastName={rec.employee.lastName}
          employeeId={rec.employee.employeeId} avatarUrl={rec.employee.avatarUrl}
          department={rec.employee.department} role={rec.employee.user?.role}
        />
        <MetaChip icon={CalendarDays}>{fmtDate(rec.date)}</MetaChip>
      </div>

      <Divider />

      <div className="space-y-3 px-5 py-4">
        {!rec.checkIn && !rec.checkOut && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Absent → Present
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <MetaChip icon={Clock}>
            Current: {rec.checkIn ? fmtTime(rec.checkIn) : '—'} – {rec.checkOut ? fmtTime(rec.checkOut) : '—'}
          </MetaChip>
          <MetaChip icon={Clock} className="text-orange-600 dark:text-orange-400">
            Requested: {rec.requestedCheckIn ? fmtTime(rec.requestedCheckIn) : '—'} – {rec.requestedCheckOut ? fmtTime(rec.requestedCheckOut) : '—'}
          </MetaChip>
        </div>
        {rec.adjustmentReason && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Reason: </span>{rec.adjustmentReason}
          </p>
        )}
      </div>

      <Divider />

      <div className="flex items-center justify-end gap-2 px-5 py-3">
        <RejectBtn onClick={onReject} />
        <ApproveBtn onClick={onApprove} disabled={reviewing} label="Approve" variant="green" />
      </div>
    </div>
  )
}

function AdjustmentsSection({ onModal }: { onModal: (m: ModalState) => void }) {
  const { data: requests = [], isLoading } = usePendingAdjustments()
  const review = useReviewAdjustment()

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!requests.length) return <Empty icon={Clock} message="No attendance adjustment requests pending review." />

  return (
    <div className="space-y-3">
      <SectionLabel label="Attendance adjustment requests" count={requests.length} />
      {(requests as (AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> })[]).map(rec => (
        <AdjustmentCard key={rec.id} rec={rec}
          onApprove={() => onModal({ type: 'approve-adjustment', id: rec.id })}
          onReject={() => onModal({ type: 'reject-adjustment', id: rec.id })}
          reviewing={review.isPending}
        />
      ))}
    </div>
  )
}

// ─── History section ──────────────────────────────────────────────────────────

function MonthPicker({ month, year, onChange }: {
  month: number; year: number
  onChange: (m: number, y: number) => void
}) {
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1

  function prev() {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  function next() {
    if (isCurrent) return
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
      <button onClick={prev} className="rounded-md p-1.5 hover:bg-muted transition-colors">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[136px] text-center text-sm font-medium tabular-nums">
        {FULL_MONTHS[month - 1]} {year}
      </span>
      <button onClick={next} disabled={isCurrent} className="rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-30">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

const TYPE_CONFIG = {
  LEAVE:      { icon: CalendarDays, label: 'Leave',       cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  EXCUSE:     { icon: Clock,        label: 'Late Excuse', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  ADJUSTMENT: { icon: Clock,        label: 'Adjustment',  cls: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
} as const

const ACTION_CONFIG = {
  APPROVED:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', border: 'border-l-emerald-500' },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',     border: 'border-l-red-500' },
  FORWARDED: { label: 'Forwarded', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-l-blue-500' },
} as const

function HistoryCard({ item }: { item: ApprovalHistoryItem }) {
  const emp = item.employee
  const typeCfg   = TYPE_CONFIG[item.type]
  const actionCfg = ACTION_CONFIG[item.action as keyof typeof ACTION_CONFIG] ?? ACTION_CONFIG.FORWARDED
  const TypeIcon  = typeCfg.icon

  const detail = (() => {
    if (item.type === 'LEAVE') {
      const l = item as Extract<ApprovalHistoryItem, { type: 'LEAVE' }>
      return { primary: fmtDateRange(l.startDate, l.endDate), secondary: `${Number(l.totalDays)} day${Number(l.totalDays) !== 1 ? 's' : ''}` }
    }
    if (item.type === 'ADJUSTMENT') {
      const a = item as Extract<ApprovalHistoryItem, { type: 'ADJUSTMENT' }>
      return { primary: fmtDate(a.date), secondary: 'Attendance correction' }
    }
    const e = item as Extract<ApprovalHistoryItem, { type: 'EXCUSE' }>
    return { primary: fmtDate(e.date), secondary: `${e.lateMinutes}m late` }
  })()

  const extraText = (() => {
    if (item.type === 'EXCUSE') {
      return (item as Extract<ApprovalHistoryItem, { type: 'EXCUSE' }>).lateExcuse
    }
    return item.comment
  })()

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-sm border-l-[3px]', actionCfg.border)}>
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Left: employee + details */}
        <div className="min-w-0 flex-1 space-y-3">
          <EmployeeRow
            firstName={emp.firstName} lastName={emp.lastName}
            employeeId={emp.employeeId} avatarUrl={undefined}
            department={emp.department}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold', typeCfg.cls)}>
              <TypeIcon className="h-3.5 w-3.5" />{typeCfg.label}
              {item.type === 'LEAVE' && (
                <span className="opacity-70">· {(item as Extract<ApprovalHistoryItem, { type: 'LEAVE' }>).leaveType?.name}</span>
              )}
            </span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', actionCfg.cls)}>
              {actionCfg.label}
            </span>
            {item.level != null && (
              <span className="text-xs text-muted-foreground">Level {item.level}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetaChip icon={CalendarDays}>{detail.primary}</MetaChip>
            <span className="text-xs font-semibold">{detail.secondary}</span>
          </div>
          {extraText && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {extraText}
            </p>
          )}
        </div>

        {/* Right: approver block */}
        {item.approver && (
          <div className="shrink-0 text-right space-y-0.5">
            <p className="text-xs font-semibold leading-tight">
              {item.approver.firstName} {item.approver.lastName}
            </p>
            {item.approver.jobTitle && (
              <p className="text-[11px] text-muted-foreground">{item.approver.jobTitle.name}</p>
            )}
            <p className="text-[11px] text-muted-foreground pt-1">{fmtDate(item.actionAt)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function HistorySection({ month, year, onMonthChange }: {
  month: number; year: number
  onMonthChange: (m: number, y: number) => void
}) {
  const { data: items = [], isLoading } = useApprovalHistory(month, year)

  const counts = {
    LEAVE:      items.filter(i => i.type === 'LEAVE').length,
    EXCUSE:     items.filter(i => i.type === 'EXCUSE').length,
    ADJUSTMENT: items.filter(i => i.type === 'ADJUSTMENT').length,
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker month={month} year={year} onChange={onMonthChange} />
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            {(Object.entries(counts) as [keyof typeof counts, number][]).filter(([, n]) => n > 0).map(([type, n]) => {
              const cfg = TYPE_CONFIG[type]
              const Icon = cfg.icon
              return (
                <span key={type} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', cfg.cls)}>
                  <Icon className="h-3 w-3" />{n} {cfg.label.toLowerCase()}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <Empty icon={History} message={`No approval actions recorded in ${FULL_MONTHS[month - 1]} ${year}.`} />
      ) : (
        <div className="space-y-3">
          {items.map(item => <HistoryCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/25" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'leave' | 'excuses' | 'adjustments' | 'history'

export default function ApprovalsPage() {
  const [tab, setTab]   = useState<Tab>('leave')
  const [modal, setModal] = useState<ModalState>(null)

  const now = new Date()
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1)
  const [historyYear, setHistoryYear]   = useState(now.getFullYear())

  const { data: leaveApps = [] }     = usePendingApprovals()
  const { data: excuses = [] }       = usePendingExcuses()
  const { data: adjustments = [] }   = usePendingAdjustments()

  const leavePending       = (leaveApps as LeaveApplication[]).filter(
    a => a.status === 'PENDING' || a.status === 'CANCEL_REQUESTED'
  ).length
  const excusesPending     = excuses.length
  const adjustmentsPending = adjustments.length

  const rejectLeave      = useRejectLeave()
  const rejectCancel     = useRejectCancelLeave()
  const reviewExcuse     = useReviewExcuse()
  const reviewAdjustment = useReviewAdjustment()

  async function handleModalSubmit(reason: string) {
    if (!modal) return
    if (modal.type === 'reject-leave')       await rejectLeave.mutateAsync({ id: modal.id, rejectionReason: reason })
    if (modal.type === 'reject-cancel')      await rejectCancel.mutateAsync({ id: modal.id, reason })
    if (modal.type === 'reject-excuse')      await reviewExcuse.mutateAsync({ id: modal.id, approved: false })
    if (modal.type === 'approve-excuse')     await reviewExcuse.mutateAsync({ id: modal.id, approved: true, newStatus: 'PRESENT' })
    if (modal.type === 'reject-adjustment')  await reviewAdjustment.mutateAsync({ id: modal.id, approved: false, rejectionReason: reason })
    if (modal.type === 'approve-adjustment') await reviewAdjustment.mutateAsync({ id: modal.id, approved: true })
    setModal(null)
  }

  const isSubmitting = rejectLeave.isPending || rejectCancel.isPending || reviewExcuse.isPending || reviewAdjustment.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and action leave requests, late excuses, and approval history"
      />

      {/* Tab bar */}
      <div className="border-b">
        <div className="flex gap-1">
          <TabBtn label="Leave"        count={leavePending}       active={tab === 'leave'}       onClick={() => setTab('leave')} />
          <TabBtn label="Late Excuses" count={excusesPending}     active={tab === 'excuses'}      onClick={() => setTab('excuses')} />
          <TabBtn label="Adjustments"  count={adjustmentsPending} active={tab === 'adjustments'} onClick={() => setTab('adjustments')} />
          <TabBtn label="History"      count={0}                  active={tab === 'history'}     onClick={() => setTab('history')} />
        </div>
      </div>

      {/* Content */}
      <div>
        {tab === 'leave'       && <LeaveSection       onModal={setModal} />}
        {tab === 'excuses'     && <ExcusesSection     onModal={setModal} />}
        {tab === 'adjustments' && <AdjustmentsSection onModal={setModal} />}
        {tab === 'history' && (
          <HistorySection
            month={historyMonth} year={historyYear}
            onMonthChange={(m, y) => { setHistoryMonth(m); setHistoryYear(y) }}
          />
        )}
      </div>

      {/* Modals */}
      {(modal?.type === 'approve-excuse' || modal?.type === 'approve-adjustment') && (
        <ConfirmModal
          title={modal.type === 'approve-excuse' ? 'Approve late excuse' : 'Approve attendance adjustment'}
          description={
            modal.type === 'approve-excuse'
              ? 'Mark this attendance record as Present and close the excuse.'
              : 'The requested check-in/check-out time will be applied to this attendance record.'
          }
          confirmLabel="Yes, Approve"
          confirmCls="bg-emerald-600 hover:bg-emerald-700"
          submitting={isSubmitting}
          onConfirm={() => handleModalSubmit('')}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal.type !== 'approve-excuse' && modal.type !== 'approve-adjustment' && (
        <ReasonModal
          title={
            modal.type === 'reject-leave'      ? 'Reject leave request' :
            modal.type === 'reject-cancel'     ? 'Keep leave active' :
            modal.type === 'reject-adjustment' ? 'Reject attendance adjustment' :
            'Reject excuse'
          }
          description={
            modal.type === 'reject-leave'      ? 'This reason will be sent to the employee.' :
            modal.type === 'reject-cancel'     ? 'Explain why the cancellation request is being denied.' :
            modal.type === 'reject-adjustment' ? 'This reason will be sent to the employee; the attendance record will remain unchanged.' :
            'The late attendance record will remain unchanged.'
          }
          placeholder="Enter reason…"
          submitting={isSubmitting}
          onSubmit={handleModalSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
