'use client'

import { useState, useRef } from 'react'
import {
  useLeaveTypes,
  useLeaveBalances,
  useMyLeaveApplications,
  useApplyLeave,
  useUploadLeaveAttachment,
  useCancelLeave,
  useUpdateCancelReason,
  type LeaveType,
  type LeaveBalance,
  type LeaveApplication,
} from '@/lib/api/hooks/useLeave'
import { Card, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  Plus,
  CalendarDays,
  Coins,
  X,
  Info,
  Paperclip,
  Upload,
  FileText,
  ImageIcon,
  Pencil,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LEAVE_COLORS: Record<string, string> = {
  AL: 'bg-blue-500',
  SL: 'bg-emerald-500',
  CL: 'bg-amber-500',
  ML: 'bg-rose-500',
  UL: 'bg-slate-500',
}

const CONSUME_TYPES = [
  { value: 'FULL_DAY', label: 'Full Day' },
  { value: 'FIRST_HALF', label: '1st Half Day' },
  { value: 'SECOND_HALF', label: '2nd Half Day' },
] as const

type ConsumeType = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sd = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
  if (start.slice(0, 10) === end.slice(0, 10)) return sd
  return `${sd} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`
}

function workingDaysBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'mb-1.5 block text-sm font-medium'

export default function LeavePage() {
  const year = new Date().getFullYear()
  const today = new Date().toISOString().split('T')[0]

  const { data: types = [], isLoading: typesLoading } = useLeaveTypes()
  const { data: balances = [], isLoading: balLoading } = useLeaveBalances(year)
  const { data: applications = [], isLoading: appLoading } = useMyLeaveApplications()
  const apply = useApplyLeave()
  const uploadFile = useUploadLeaveAttachment()
  const cancel = useCancelLeave()
  const updateCancelReason = useUpdateCancelReason()

  // ── Apply modal state ──────────────────────────────────────────────
  const [showApply, setShowApply] = useState(false)
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [consumeType, setConsumeType] = useState<ConsumeType>('FULL_DAY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [reason, setReason] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [applyError, setApplyError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isHalfDay = consumeType !== 'FULL_DAY'
  const selectedType = types.find((t) => t.id === leaveTypeId)
  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId)
  const available = selectedBalance
    ? Number(selectedBalance.entitled) -
      Number(selectedBalance.taken) -
      Number(selectedBalance.pending)
    : null
  const effectiveEnd = isHalfDay ? startDate : endDate || startDate
  const days = isHalfDay ? (startDate ? 0.5 : 0) : workingDaysBetween(startDate, effectiveEnd)

  // Only sick leave (code SL) allows selecting past dates for emergency applications
  const allowPastDates = selectedType?.code === 'SL'
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const minStartDate = allowPastDates ? ninetyDaysAgo : today

  function resetApplyForm() {
    setLeaveTypeId('')
    setConsumeType('FULL_DAY')
    setStartDate('')
    setEndDate('')
    setLocation('')
    setReason('')
    setAttachment(null)
    setApplyError('')
  }

  function openApply() {
    resetApplyForm()
    setShowApply(true)
  }
  function closeApply() {
    setShowApply(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 2 * 1024 * 1024) {
      setApplyError('File must be under 2MB')
      return
    }
    setAttachment(file)
    setApplyError('')
  }

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault()
    setApplyError('')

    if (!leaveTypeId) {
      setApplyError('Select a leave type')
      return
    }
    if (!startDate) {
      setApplyError('Select a start date')
      return
    }
    if (!location.trim()) {
      setApplyError('Enter your location')
      return
    }
    if (!reason.trim()) {
      setApplyError('Enter a reason')
      return
    }
    if (days <= 0) {
      setApplyError('No working days in selected range')
      return
    }
    if (available !== null && days > available) {
      setApplyError(
        `Insufficient balance — available: ${available} day${available !== 1 ? 's' : ''}`
      )
      return
    }

    try {
      let attachmentPath: string | undefined
      if (attachment) {
        attachmentPath = await uploadFile.mutateAsync(attachment)
      }

      await apply.mutateAsync({
        leaveTypeId,
        consumeType,
        startDate,
        endDate: isHalfDay ? startDate : endDate || startDate,
        location: location.trim(),
        reason: reason.trim(),
        attachmentPath,
      })
      closeApply()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            'Failed to apply')
          : 'Failed to apply'
      setApplyError(msg)
    }
  }

  // ── Pending cancel confirmation ────────────────────────────────────
  const [pendingCancelConfirm, setPendingCancelConfirm] = useState<{
    id: string
    leaveName: string
  } | null>(null)

  // ── Approved leave cancel request modal ────────────────────────────
  const [cancelModal, setCancelModal] = useState<{ id: string; leaveName: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // ── Edit cancel reason (CANCEL_REQUESTED only) ─────────────────────
  const [editReasonModal, setEditReasonModal] = useState<{
    id: string
    currentReason: string
  } | null>(null)
  const [editReasonText, setEditReasonText] = useState('')

  async function submitCancelRequest() {
    if (!cancelModal || !cancelReason.trim()) return
    await cancel.mutateAsync({ id: cancelModal.id, cancelReason: cancelReason.trim() })
    setCancelModal(null)
    setCancelReason('')
  }

  const isSubmitting = apply.isPending || uploadFile.isPending

  return (
    <>
      <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Leave</h1>
          <p className="text-sm text-muted-foreground">Balances, applications and history</p>
        </div>
        <button
          onClick={openApply}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Apply for Leave
        </button>
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
                    {pending > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">{pending} pending</span>
                    )}
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
          <button
            onClick={openApply}
            className="flex items-center gap-1 text-xs font-medium text-primary"
          >
            <Plus className="h-3 w-3" /> New
          </button>
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
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white',
                      LEAVE_COLORS[app.leaveType?.code ?? ''] ?? 'bg-primary'
                    )}
                  >
                    {app.leaveType?.code ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.leaveType?.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {fmtRange(app.startDate, app.endDate)} · {Number(app.totalDays)} day
                      {Number(app.totalDays) > 1 ? 's' : ''}
                    </p>
                    {app.status === 'CANCEL_REQUESTED' && app.cancelReason && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
                        <span>Cancel reason: {app.cancelReason}</span>
                        <button
                          onClick={() => {
                            setEditReasonModal({ id: app.id, currentReason: app.cancelReason! })
                            setEditReasonText(app.cancelReason!)
                          }}
                          className="ml-0.5 rounded p-0.5 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                          title="Edit cancel reason"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={app.status} />
                  {app.status === 'PENDING' && (
                    <button
                      onClick={() =>
                        setPendingCancelConfirm({
                          id: app.id,
                          leaveName: app.leaveType?.name ?? 'leave',
                        })
                      }
                      disabled={cancel.isPending}
                      className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  {app.status === 'APPROVED' && app.startDate.slice(0, 10) > today && (
                    <button
                      onClick={() => {
                        setCancelModal({ id: app.id, leaveName: app.leaveType?.name ?? 'leave' })
                        setCancelReason('')
                      }}
                      disabled={cancel.isPending}
                      className="text-[11px] text-orange-600 hover:text-orange-700 dark:text-orange-400 disabled:opacity-50"
                    >
                      Request Cancellation
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>

      {/* ── Apply Leave Modal ───────────────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-semibold">Apply for Leave</h2>
                <p className="text-xs text-muted-foreground">Fill in all required fields</p>
              </div>
              <button
                onClick={closeApply}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {typesLoading ? (
                <Spinner />
              ) : (
                <form id="apply-form" onSubmit={handleApplySubmit} className="space-y-4">
                  {/* Row 1: Leave Type */}
                  <div>
                    <label className={labelCls}>
                      Leave Type <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={leaveTypeId}
                      onChange={(e) => {
                        setLeaveTypeId(e.target.value)
                        setApplyError('')
                      }}
                      className={inputCls}
                    >
                      <option value="">Select leave type…</option>
                      {types.map((t: LeaveType) => {
                        const bal = balances.find((b: LeaveBalance) => b.leaveTypeId === t.id)
                        const avail = bal
                          ? Number(bal.entitled) - Number(bal.taken) - Number(bal.pending)
                          : null
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} {avail !== null ? `(${avail} days available)` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Balance preview */}
                  {selectedType && selectedBalance && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <span className="font-medium">{selectedType.name}:</span>{' '}
                        <span className="text-muted-foreground">
                          Entitled {Number(selectedBalance.entitled)} · Taken{' '}
                          {Number(selectedBalance.taken)} · Pending{' '}
                          {Number(selectedBalance.pending)} ·
                        </span>{' '}
                        <span className="font-semibold text-foreground">Available {available}</span>
                        {selectedType.minNoticeDays > 0 && (
                          <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                            ⚠ Requires {selectedType.minNoticeDays} day(s) advance notice
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Row 2: Consume type */}
                  <div>
                    <label className={labelCls}>
                      Leave Consume Type <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      {CONSUME_TYPES.map((ct) => (
                        <button
                          key={ct.value}
                          type="button"
                          onClick={() => {
                            setConsumeType(ct.value)
                            if (ct.value !== 'FULL_DAY') setEndDate('')
                          }}
                          className={cn(
                            'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition',
                            consumeType === ct.value
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          )}
                        >
                          {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 3: Dates */}
                  <div className={cn('grid gap-3', isHalfDay ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div>
                      <label className={labelCls}>
                        {isHalfDay ? 'Date' : 'From Date'}{' '}
                        <span className="text-destructive">*</span>
                        {allowPastDates && (
                          <span className="ml-1.5 text-[10px] font-normal text-blue-600 dark:text-blue-400">
                            Past dates allowed
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        min={minStartDate}
                        onChange={(e) => {
                          setStartDate(e.target.value)
                          if (!endDate && !isHalfDay) setEndDate(e.target.value)
                        }}
                        className={inputCls}
                      />
                    </div>
                    {!isHalfDay && (
                      <div>
                        <label className={labelCls}>
                          To Date <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="date"
                          value={endDate || startDate}
                          min={startDate || minStartDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>

                  {/* Days preview */}
                  {startDate && days >= 0 && (
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                        available !== null && days > available
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      {days} working day{days !== 1 ? 's' : ''} selected
                      {available !== null &&
                        days > available &&
                        ` — exceeds balance by ${days - available}`}
                    </div>
                  )}

                  {/* Row 4: Location */}
                  <div>
                    <label className={labelCls}>
                      Location <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Home, Dhaka, Abroad…"
                      className={inputCls}
                    />
                  </div>

                  {/* Row 5: Reason */}
                  <div>
                    <label className={labelCls}>
                      Reason <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Briefly describe the reason for your leave…"
                      className={cn(inputCls, 'resize-none')}
                    />
                  </div>

                  {/* Row 6: Attachment */}
                  <div>
                    <label className={labelCls}>
                      Attachment
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (PDF or image, max 2MB)
                      </span>
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {attachment ? (
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        {attachment.type === 'application/pdf' ? (
                          <FileText className="h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                          <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachment(null)
                            if (fileRef.current) fileRef.current.value = ''
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                      >
                        <Upload className="h-4 w-4" />
                        Click to upload attachment
                      </button>
                    )}
                  </div>

                  {applyError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {applyError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeApply}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="apply-form"
                disabled={isSubmitting || (available !== null && days > available) || days <= 0}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadFile.isPending
                  ? 'Uploading…'
                  : apply.isPending
                    ? 'Submitting…'
                    : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending leave cancel confirmation ──────────────────────── */}
      {pendingCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Cancel leave request?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Are you sure you want to cancel your{' '}
                  <span className="font-medium">{pendingCancelConfirm.leaveName}</span> application?
                  This will remove it from the approval queue and cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingCancelConfirm(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Keep it
              </button>
              <button
                onClick={async () => {
                  await cancel.mutateAsync({ id: pendingCancelConfirm.id })
                  setPendingCancelConfirm(null)
                }}
                disabled={cancel.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancel.isPending ? 'Cancelling…' : 'Yes, cancel it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancellation Request Modal ──────────────────────────────── */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Request cancellation</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Cancel your approved <span className="font-medium">{cancelModal.leaveName}</span>{' '}
                  leave
                </p>
              </div>
              <button
                onClick={() => setCancelModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-300">
              This leave has already been approved. Your manager will need to approve the
              cancellation before it takes effect.
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium">
                Reason for cancellation <span className="text-destructive">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Why do you need to cancel this leave?"
                autoFocus
                className={cn(inputCls, 'resize-none')}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Go back
              </button>
              <button
                onClick={submitCancelRequest}
                disabled={!cancelReason.trim() || cancel.isPending}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {cancel.isPending ? 'Submitting…' : 'Request Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Edit cancel reason modal ───────────────────────────────── */}
      {editReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Update cancel reason</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  You can update the reason while your cancellation is awaiting manager approval.
                </p>
              </div>
              <button
                onClick={() => setEditReasonModal(null)}
                className="rounded-lg p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className={labelCls}>
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={4}
              value={editReasonText}
              onChange={(e) => setEditReasonText(e.target.value)}
              maxLength={500}
              className={cn(inputCls, 'resize-none')}
              placeholder="Update your cancellation reason…"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditReasonModal(null)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Discard
              </button>
              <button
                onClick={async () => {
                  if (!editReasonText.trim()) return
                  await updateCancelReason.mutateAsync({
                    id: editReasonModal.id,
                    cancelReason: editReasonText.trim(),
                  })
                  setEditReasonModal(null)
                }}
                disabled={!editReasonText.trim() || updateCancelReason.isPending}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {updateCancelReason.isPending ? 'Saving…' : 'Save reason'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
