'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  usePendingApprovals,
  useApproveLeave,
  useRejectLeave,
  useApproveCancelLeave,
  useRejectCancelLeave,
  useLeaveAttachmentUrl,
} from '@/lib/api/hooks/useLeave'
import type { LeaveApplication, LeaveApprovalHistory } from '@/lib/api/hooks/useLeave'
import { usePendingExcuses, useReviewExcuse, usePendingAdjustments, useReviewAdjustment } from '@/lib/api/hooks/useAttendance'
import type { AttendanceRecord } from '@/lib/api/hooks/useAttendance'
import { useApprovalHistory } from '@/lib/api/hooks/useApprovalHistory'
import type { ApprovalHistoryItem } from '@/lib/api/hooks/useApprovalHistory'
import { Avatar, PageHeader, RolePill, SubmitOverlay } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Undo2,
  AlertCircle, Building2, History, ArrowRight, Quote, UserCheck,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Paperclip,
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
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
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

// Wraps a card so that approving/rejecting it (which removes it from the
// underlying query data) slides it out to the right instead of vanishing
// instantly — `layout` makes framer-motion smoothly animate the position
// change for the remaining siblings as they move up to fill the gap.
function AnimatedCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={false}
      exit={{ opacity: 0, x: 300 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
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

function ApproveBtn({ onClick, loading, disabled, label, variant = 'green' }: {
  onClick: () => void; loading: boolean; disabled?: boolean; label: string
  variant?: 'green' | 'orange'
}) {
  return (
    <button
      onClick={onClick} disabled={loading || disabled}
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50',
        variant === 'green' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {label}
    </button>
  )
}

function RejectBtn({ onClick, disabled, label = 'Reject' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive disabled:opacity-50"
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
        'relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border"
        onClick={e => e.stopPropagation()}
      >
        <SubmitOverlay show={submitting} label="Submitting…" />
        <h3 className="mb-1 font-semibold text-base">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <textarea
          autoFocus value={val} onChange={e => setVal(e.target.value)} rows={3}
          disabled={submitting}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(val)}
            disabled={!val.trim() || submitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border"
        onClick={e => e.stopPropagation()}
      >
        <SubmitOverlay show={submitting} label="Saving…" />
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={submitting}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50', confirmCls)}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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

const LEAVE_TYPE_CHIP: Record<string, string> = {
  AL:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  SL:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  CL:  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  ML:  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  UL:  'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  CPL: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
}

function LeaveCard({ app, onApprove, onReject, approveLabel, approveVariant, approving, cancelNote }: {
  app: LeaveApplication
  onApprove: () => void; onReject: () => void
  approveLabel: string; approveVariant: 'green' | 'orange'
  approving: boolean; cancelNote?: string
}) {
  const emp = app.employee
  const days = Number(app.totalDays)
  const isCancel = approveVariant === 'orange'
  const sameDay = app.startDate.slice(0, 10) === app.endDate.slice(0, 10)
  const dayTint = isCancel
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
  const typeChip = LEAVE_TYPE_CHIP[app.leaveType?.code ?? ''] ?? 'bg-primary/10 text-primary'

  const attachmentUrl = useLeaveAttachmentUrl()
  const [viewingAttachment, setViewingAttachment] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')

  async function handleViewAttachment() {
    setAttachmentError('')
    setViewingAttachment(true)
    try {
      const url = await attachmentUrl.mutateAsync(app.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setAttachmentError('Could not open attachment. Please try again.')
    } finally {
      setViewingAttachment(false)
    }
  }

  return (
    <div className={cn(
      'overflow-hidden rounded-xl border border-l-[3px] bg-card shadow-sm transition-shadow hover:shadow-md',
      isCancel ? 'border-l-orange-500' : 'border-l-blue-500'
    )}>
      {/* Header: employee + day-count hero */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        {emp && (
          <EmployeeRow
            firstName={emp.firstName} lastName={emp.lastName}
            employeeId={emp.employeeId} avatarUrl={emp.avatarUrl}
            department={emp.department} role={emp.user?.role}
          />
        )}
        <div className={cn('shrink-0 rounded-lg px-3 py-1.5 text-center', dayTint)}>
          <p className="text-xl font-bold leading-none tabular-nums">{days}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">{days === 1 ? 'day' : 'days'}</p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3 px-4 py-4">
        {/* Leave type + applied date */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold', typeChip)}>
            <CalendarDays className="h-3.5 w-3.5" />
            {app.leaveType?.name}
          </span>
          {isCancel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
              <Undo2 className="h-3 w-3" /> Cancellation
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Applied {fmtDate(app.createdAt)}</span>
        </div>

        {/* Date range timeline */}
        {sameDay ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{fmtDate(app.startDate)}</span>
            <span className="text-xs text-muted-foreground">· single day</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</p>
              <p className="truncate text-sm font-medium">{fmtDate(app.startDate)}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">To</p>
              <p className="truncate text-sm font-medium">{fmtDate(app.endDate)}</p>
            </div>
          </div>
        )}

        {/* Reason */}
        {app.reason && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Quote className="h-3 w-3" /> Reason
            </p>
            <p className="text-sm text-muted-foreground">{app.reason}</p>
          </div>
        )}

        {/* Attachment */}
        {app.attachmentPath && (
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">Attachment</span>
            </div>
            <button
              onClick={handleViewAttachment}
              disabled={viewingAttachment}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {viewingAttachment ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              View
            </button>
          </div>
        )}
        {attachmentError && <p className="text-xs text-destructive">{attachmentError}</p>}

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

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <RejectBtn onClick={onReject} disabled={approving} label={isCancel ? 'Keep Leave' : 'Reject'} />
        <ApproveBtn onClick={onApprove} loading={approving} label={approveLabel} variant={approveVariant} />
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

  if (isLoading) return <SectionSkeleton />
  if (!pending.length && !cancelReq.length) return <Empty icon={CalendarDays} message="No leave requests pending approval." />

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="New requests" count={pending.length} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {pending.map(app => (
                <AnimatedCard key={app.id}>
                  <LeaveCard app={app}
                    onApprove={() => approve.mutateAsync({ id: app.id })}
                    onReject={() => onModal({ type: 'reject-leave', id: app.id })}
                    approveLabel="Approve" approveVariant="green"
                    approving={approve.isPending && approve.variables?.id === app.id}
                  />
                </AnimatedCard>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      {cancelReq.length > 0 && (
        <div className="space-y-3">
          <SectionLabel label="Cancellation requests" count={cancelReq.length} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {cancelReq.map(app => (
                <AnimatedCard key={app.id}>
                  <LeaveCard app={app}
                    onApprove={() => approveCancel.mutateAsync(app.id)}
                    onReject={() => onModal({ type: 'reject-cancel', id: app.id })}
                    approveLabel="Approve Cancel" approveVariant="orange"
                    approving={approveCancel.isPending && approveCancel.variables === app.id}
                    cancelNote={app.cancelReason ?? undefined}
                  />
                </AnimatedCard>
              ))}
            </AnimatePresence>
          </div>
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
          {fmtMinutes(rec.lateMinutes ?? 0)} late
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
        <RejectBtn onClick={onReject} disabled={reviewing} />
        <ApproveBtn onClick={onApprove} loading={false} disabled={reviewing} label="Approve" variant="green" />
      </div>
    </div>
  )
}

function ExcusesSection({ onModal }: { onModal: (m: ModalState) => void }) {
  const { data: excuses = [], isLoading } = usePendingExcuses()
  const review = useReviewExcuse()

  if (isLoading) return <SectionSkeleton />
  if (!excuses.length) return <Empty icon={Clock} message="No late excuses pending review." />

  return (
    <div className="space-y-3">
      <SectionLabel label="Late arrival excuses" count={excuses.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {(excuses as (AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> })[]).map(rec => (
            <AnimatedCard key={rec.id}>
              <ExcuseCard rec={rec}
                onApprove={() => onModal({ type: 'approve-excuse', id: rec.id })}
                onReject={() => onModal({ type: 'reject-excuse', id: rec.id })}
                reviewing={review.isPending && review.variables?.id === rec.id}
              />
            </AnimatedCard>
          ))}
        </AnimatePresence>
      </div>
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
        <RejectBtn onClick={onReject} disabled={reviewing} />
        <ApproveBtn onClick={onApprove} loading={false} disabled={reviewing} label="Approve" variant="green" />
      </div>
    </div>
  )
}

function AdjustmentsSection({ onModal }: { onModal: (m: ModalState) => void }) {
  const { data: requests = [], isLoading } = usePendingAdjustments()
  const review = useReviewAdjustment()

  if (isLoading) return <SectionSkeleton />
  if (!requests.length) return <Empty icon={Clock} message="No attendance adjustment requests pending review." />

  return (
    <div className="space-y-3">
      <SectionLabel label="Attendance adjustment requests" count={requests.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {(requests as (AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> })[]).map(rec => (
            <AnimatedCard key={rec.id}>
              <AdjustmentCard rec={rec}
                onApprove={() => onModal({ type: 'approve-adjustment', id: rec.id })}
                onReject={() => onModal({ type: 'reject-adjustment', id: rec.id })}
                reviewing={review.isPending && review.variables?.id === rec.id}
              />
            </AnimatedCard>
          ))}
        </AnimatePresence>
      </div>
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
    return { primary: fmtDate(e.date), secondary: `${fmtMinutes(e.lateMinutes)} late` }
  })()

  const extraText = (() => {
    if (item.type === 'EXCUSE') {
      return (item as Extract<ApprovalHistoryItem, { type: 'EXCUSE' }>).lateExcuse
    }
    return item.comment
  })()

  const ActionIcon = item.action === 'APPROVED' ? CheckCircle2 : item.action === 'REJECTED' ? XCircle : History

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-l-[3px] bg-card shadow-sm', actionCfg.border)}>
      {/* Header: employee + action badge */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <EmployeeRow
          firstName={emp.firstName} lastName={emp.lastName}
          employeeId={emp.employeeId} avatarUrl={undefined}
          department={emp.department}
        />
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', actionCfg.cls)}>
          <ActionIcon className="h-3 w-3" /> {actionCfg.label}
        </span>
      </div>

      {/* Body: type + detail + note */}
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold', typeCfg.cls)}>
            <TypeIcon className="h-3.5 w-3.5" />{typeCfg.label}
            {item.type === 'LEAVE' && (
              <span className="opacity-70">· {(item as Extract<ApprovalHistoryItem, { type: 'LEAVE' }>).leaveType?.name}</span>
            )}
          </span>
          <MetaChip icon={CalendarDays}>{detail.primary}</MetaChip>
          <span className="text-xs font-semibold text-muted-foreground">{detail.secondary}</span>
        </div>
        {extraText && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{extraText}</p>
        )}
      </div>

      {/* Footer: who actioned it + when */}
      {item.approver && (
        <div className="mt-auto flex items-center gap-1.5 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            by <span className="font-medium text-foreground">{item.approver.firstName} {item.approver.lastName}</span>
            {item.approver.jobTitle && ` · ${item.approver.jobTitle.name}`}
          </span>
          <span className="ml-auto shrink-0">{fmtDate(item.actionAt)}</span>
        </div>
      )}
    </div>
  )
}

// Windowed page numbers: 1 … (p-1) p (p+1) … last
function pageWindow(current: number, total: number): (number | '…')[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

function TypeChip({ label, count, active, onClick, icon: Icon }: {
  label: string; count: number; active: boolean; onClick: () => void; icon?: React.ElementType
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <span className={cn(active ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{count}</span>
    </button>
  )
}

type HistoryType = 'ALL' | 'LEAVE' | 'EXCUSE' | 'ADJUSTMENT'
type HistoryAction = 'ALL' | 'APPROVED' | 'REJECTED' | 'FORWARDED'
const HISTORY_PAGE_SIZE = 8

function HistorySection({ month, year, onMonthChange }: {
  month: number; year: number
  onMonthChange: (m: number, y: number) => void
}) {
  const { data: items = [], isLoading } = useApprovalHistory(month, year)
  const [typeFilter, setTypeFilter] = useState<HistoryType>('ALL')
  const [actionFilter, setActionFilter] = useState<HistoryAction>('ALL')
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever the month or filters change.
  useEffect(() => { setPage(1) }, [month, year, typeFilter, actionFilter])

  const counts = {
    LEAVE:      items.filter(i => i.type === 'LEAVE').length,
    EXCUSE:     items.filter(i => i.type === 'EXCUSE').length,
    ADJUSTMENT: items.filter(i => i.type === 'ADJUSTMENT').length,
  }

  const filtered = items.filter(
    i => (typeFilter === 'ALL' || i.type === typeFilter) && (actionFilter === 'ALL' || i.action === actionFilter)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)
  const hasFilters = typeFilter !== 'ALL' || actionFilter !== 'ALL'

  return (
    <div className="space-y-4">
      {/* Controls: month picker + action filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker month={month} year={year} onChange={onMonthChange} />
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as HistoryAction)}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All actions</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="FORWARDED">Forwarded</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setTypeFilter('ALL'); setActionFilter('ALL') }}
              className="flex h-9 items-center gap-1 rounded-md border px-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <XCircle className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Type filter chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <TypeChip label="All" count={items.length} active={typeFilter === 'ALL'} onClick={() => setTypeFilter('ALL')} />
          {(['LEAVE', 'EXCUSE', 'ADJUSTMENT'] as const).filter(t => counts[t] > 0).map(t => (
            <TypeChip
              key={t}
              label={TYPE_CONFIG[t].label}
              count={counts[t]}
              icon={TYPE_CONFIG[t].icon}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <SectionSkeleton />
      ) : items.length === 0 ? (
        <Empty icon={History} message={`No approval actions recorded in ${FULL_MONTHS[month - 1]} ${year}.`} />
      ) : filtered.length === 0 ? (
        <Empty icon={History} message="No actions match these filters." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {pageItems.map(item => <HistoryCard key={item.id} item={item} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
              <span className="text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'action' : 'actions'} · page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">Previous</button>
                {pageWindow(page, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn('min-w-8 rounded-md border px-2.5 py-1', p === page ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >
                      {p}
                    </button>
                  )
                )}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-l-[3px] border-l-muted bg-card shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-56 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <Divider />
      <div className="space-y-2 px-5 py-4">
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <Divider />
      <div className="flex justify-end gap-2 px-5 py-3">
        <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
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

const VALID_TABS: Tab[] = ['leave', 'excuses', 'adjustments', 'history']

export default function ApprovalsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestedTab = searchParams.get('tab') as Tab | null
  const [tab, setTab]   = useState<Tab>(requestedTab && VALID_TABS.includes(requestedTab) ? requestedTab : 'leave')
  const [modal, setModal] = useState<ModalState>(null)

  // Keep the tab in the URL so it's shareable / back-button friendly and the
  // dashboard deep-links (?tab=…) stay consistent.
  function changeTab(t: Tab) {
    setTab(t)
    router.replace(`/approvals?tab=${t}`, { scroll: false })
  }

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
        <div className="scrollbar-thin flex gap-1 overflow-x-auto">
          <TabBtn label="Leave"        count={leavePending}       active={tab === 'leave'}       onClick={() => changeTab('leave')} />
          <TabBtn label="Late Excuses" count={excusesPending}     active={tab === 'excuses'}      onClick={() => changeTab('excuses')} />
          <TabBtn label="Adjustments"  count={adjustmentsPending} active={tab === 'adjustments'} onClick={() => changeTab('adjustments')} />
          <TabBtn label="History"      count={0}                  active={tab === 'history'}     onClick={() => changeTab('history')} />
        </div>
      </div>

      {/* Content — clip horizontal overflow so a card's slide-out exit
          animation (x: 300) doesn't briefly show a page-wide horizontal scrollbar. */}
      <div className="overflow-x-hidden">
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
