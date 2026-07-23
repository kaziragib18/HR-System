'use client'

import { useState, useRef, useEffect } from 'react'
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
import { useHolidays } from '@/lib/api/hooks/useHolidays'
import { useAuthStore } from '@/store/auth.store'
import { Card, StatusBadge, Skeleton, SubmitOverlay, PageHeader } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  Plus,
  CalendarDays,
  Coins,
  X,
  Info,
  Upload,
  FileText,
  ImageIcon,
  Pencil,
  AlertTriangle,
  ArrowRight,
  Quote,
  Undo2,
  Inbox,
  Loader2,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LEAVE_COLORS: Record<string, string> = {
  AL: 'bg-blue-500',
  SL: 'bg-emerald-500',
  CL: 'bg-amber-500',
  ML: 'bg-rose-500',
  UL: 'bg-slate-500',
  CPL: 'bg-teal-500',
}

const LEAVE_TYPE_CHIP: Record<string, string> = {
  AL: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  SL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  CL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  ML: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  UL: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  CPL: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
}

const APP_PAGE_SIZE = 5
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CANCEL_REQUESTED'

function pageWindow(current: number, total: number): (number | '…')[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

function StatusChip({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      )}
    >
      {label}
      <span className={cn(active ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{count}</span>
    </button>
  )
}

/** Parse a 'YYYY-MM-DD' string as a UTC date, so day-of-week is timezone-safe. */
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function isWeekendYmd(s: string): boolean {
  const dow = parseYmd(s).getUTCDay()
  return dow === 0 || dow === 6
}

/** e.g. "Sun, 12 Jul 2026" */
function fmtDayLabel(s: string): string {
  return parseYmd(s).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const CONSUME_TYPES = [
  { value: 'FULL_DAY', label: 'Full Day' },
  { value: 'FIRST_HALF', label: '1st Half Day' },
  { value: 'SECOND_HALF', label: '2nd Half Day' },
] as const

type ConsumeType = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function workingDaysBetween(start: string, end: string, holidays?: Set<string>): number {
  if (!start || !end) return 0
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getUTCDay()
    const ds = cur.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !holidays?.has(ds)) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'mb-1.5 block text-sm font-medium'

export default function LeavePage() {
  const year = new Date().getFullYear()
  const today = new Date().toISOString().split('T')[0]

  const user = useAuthStore((s) => s.user)
  const { data: types = [], isLoading: typesLoading } = useLeaveTypes()
  const { data: balances = [], isLoading: balLoading } = useLeaveBalances(year)
  const { data: applications = [], isLoading: appLoading } = useMyLeaveApplications()
  const { data: holidays = [] } = useHolidays(year)
  const apply = useApplyLeave()
  const uploadFile = useUploadLeaveAttachment()
  const cancel = useCancelLeave()
  const updateCancelReason = useUpdateCancelReason()

  // ── Applications list: status filter + pagination ──────────────────
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [appPage, setAppPage] = useState(1)
  useEffect(() => { setAppPage(1) }, [statusFilter])

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
  // Compensatory Leave has no fixed allowance — it only tracks days taken, so
  // it's never balance-gated (available stays null → no "exceeds" checks).
  const isCplType = selectedType?.code === 'CPL'
  const available =
    !isCplType && selectedBalance
      ? Number(selectedBalance.entitled) -
        Number(selectedBalance.taken) -
        Number(selectedBalance.pending)
      : null
  const effectiveEnd = isHalfDay ? startDate : endDate || startDate

  // Public holidays for the caller's own office, as a date -> name map.
  const holidayByDate = new Map(
    holidays.filter((h) => h.office?.code === user?.officeCode).map((h) => [h.date.slice(0, 10), h.name])
  )
  const holidaySet = new Set(holidayByDate.keys())
  const days = isHalfDay ? (startDate ? 0.5 : 0) : workingDaysBetween(startDate, effectiveEnd, holidaySet)

  // Warn (not block) when a chosen date lands on a weekend or public holiday —
  // those days aren't counted, so it's usually an accidental pick.
  function dayNote(dateStr: string): string | null {
    if (!dateStr) return null
    if (holidayByDate.has(dateStr)) return `a public holiday (${holidayByDate.get(dateStr)})`
    if (isWeekendYmd(dateStr)) return 'a weekend'
    return null
  }
  const startNote = startDate ? dayNote(startDate) : null
  const endNote = !isHalfDay && effectiveEnd && effectiveEnd !== startDate ? dayNote(effectiveEnd) : null

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

  // ── Applications: status counts, filter chips (only statuses present), pagination ──
  const statusCounts: Record<string, number> = {}
  applications.forEach((a: LeaveApplication) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
  })
  const STATUS_LABEL: Record<StatusFilter, string> = {
    ALL: 'All',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    CANCEL_REQUESTED: 'Cancel Requested',
  }
  const presentStatuses = (Object.keys(STATUS_LABEL) as StatusFilter[]).filter(
    (s) => s === 'ALL' || (statusCounts[s] ?? 0) > 0
  )
  const filteredApps =
    statusFilter === 'ALL' ? applications : applications.filter((a: LeaveApplication) => a.status === statusFilter)
  const appTotalPages = Math.max(1, Math.ceil(filteredApps.length / APP_PAGE_SIZE))
  const pagedApps = filteredApps.slice((appPage - 1) * APP_PAGE_SIZE, appPage * APP_PAGE_SIZE)

  return (
    <>
      <div className="space-y-4">
      <PageHeader
        title="My Leave"
        description="Balances, applications and history"
        action={
          <button
            onClick={openApply}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        }
      />

      {/* Leave Balances */}
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Leave balance · {year}
        </p>
        {balLoading ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        ) : balances.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Coins className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No leave balances configured.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            {balances.map((b: LeaveBalance) => {
              const entitled = Number(b.entitled)
              const taken = Number(b.taken)
              const pending = Number(b.pending)
              const color = LEAVE_COLORS[b.leaveType.code] ?? 'bg-primary'
              // A leave type with no fixed allowance (e.g. Compensatory Leave)
              // isn't a quota — show the running count of days taken instead of
              // a remaining-vs-entitled bar (which would read as negative).
              const trackingOnly = entitled === 0
              if (trackingOnly) {
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{b.leaveType.name}</span>
                      <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                        {taken} taken
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all', color)}
                        style={{ width: taken + pending > 0 ? '100%' : '0%' }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>No fixed allowance</span>
                      {pending > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">{pending} pending</span>
                      )}
                    </div>
                  </div>
                )
              }
              const remaining = entitled - taken - pending
              const pct = entitled > 0 ? Math.min(100, ((taken + pending) / entitled) * 100) : 0
              return (
                <div key={b.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{b.leaveType.name}</span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

        {!appLoading && applications.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {presentStatuses.map((s) => (
              <StatusChip
                key={s}
                label={STATUS_LABEL[s]}
                count={s === 'ALL' ? applications.length : statusCounts[s] ?? 0}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        )}

        {appLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No leave applications yet.</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No {STATUS_LABEL[statusFilter].toLowerCase()} applications.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {pagedApps.map((app: LeaveApplication) => {
                const days = Number(app.totalDays)
                const sameDay = app.startDate.slice(0, 10) === app.endDate.slice(0, 10)
                const isCancelFlow = app.status === 'CANCEL_REQUESTED' || app.status === 'CANCELLED'
                const typeChip = LEAVE_TYPE_CHIP[app.leaveType?.code ?? ''] ?? 'bg-primary/10 text-primary'
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'overflow-hidden rounded-xl border border-l-[3px] bg-card shadow-sm transition-shadow hover:shadow-md',
                      isCancelFlow ? 'border-l-orange-500' : 'border-l-blue-500'
                    )}
                  >
                    {/* Header: type chip + day-count hero */}
                    <div className="flex items-start justify-between gap-3 px-4 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
                            typeChip
                          )}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {app.leaveType?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">Applied {fmtDate(app.createdAt)}</span>
                      </div>
                      <div className="shrink-0 rounded-lg bg-muted/60 px-3 py-1.5 text-center">
                        <p className="text-xl font-bold leading-none tabular-nums">{days}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {days === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="space-y-2.5 px-4 py-4">
                      {/* Date range timeline */}
                      {sameDay ? (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{fmtDate(app.startDate)}</span>
                          <span className="text-xs text-muted-foreground">· single day</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</p>
                            <p className="truncate text-sm font-medium">{fmtDate(app.startDate)}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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

                      {/* Cancel reason (with edit while still awaiting approval) */}
                      {app.status === 'CANCEL_REQUESTED' && app.cancelReason && (
                        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-800/30 dark:bg-orange-500/10">
                          <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
                          <p className="flex-1 text-sm text-orange-700 dark:text-orange-300">
                            <span className="font-medium">Cancel reason: </span>
                            {app.cancelReason}
                          </p>
                          <button
                            onClick={() => {
                              setEditReasonModal({ id: app.id, currentReason: app.cancelReason! })
                              setEditReasonText(app.cancelReason!)
                            }}
                            className="shrink-0 rounded p-0.5 text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30"
                            title="Edit cancel reason"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Footer: status + actions */}
                      <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                        <StatusBadge status={app.status} />
                        <div className="flex items-center gap-3">
                          {app.status === 'PENDING' && (
                            <button
                              onClick={() =>
                                setPendingCancelConfirm({
                                  id: app.id,
                                  leaveName: app.leaveType?.name ?? 'leave',
                                })
                              }
                              disabled={cancel.isPending}
                              className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
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
                              className="text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 disabled:opacity-50"
                            >
                              Request Cancellation
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {appTotalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''} · page {appPage} of {appTotalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={appPage <= 1}
                    onClick={() => setAppPage((p) => p - 1)}
                    className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {pageWindow(appPage, appTotalPages).map((p, i) =>
                    p === '…' ? (
                      <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setAppPage(p as number)}
                        className={cn(
                          'min-w-8 rounded-md border px-2.5 py-1',
                          p === appPage ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    disabled={appPage >= appTotalPages}
                    onClick={() => setAppPage((p) => p + 1)}
                    className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      </div>

      {/* ── Apply Leave Modal ───────────────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-2xl">
            <SubmitOverlay show={isSubmitting} label={uploadFile.isPending ? 'Uploading…' : 'Submitting…'} />
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-semibold">Apply for Leave</h2>
                <p className="text-xs text-muted-foreground">Fill in all required fields</p>
              </div>
              <button
                onClick={closeApply}
                disabled={isSubmitting}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {typesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ) : (
                <form id="apply-form" onSubmit={handleApplySubmit} className="space-y-4">
                <fieldset disabled={isSubmitting} className="contents">
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
                        // CPL has no allowance to show a "(N available)" for.
                        const avail =
                          bal && t.code !== 'CPL'
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
                        {isCplType ? (
                          <span className="text-muted-foreground">
                            Taken {Number(selectedBalance.taken)} · Pending{' '}
                            {Number(selectedBalance.pending)} ·{' '}
                            <span className="font-semibold text-foreground">No fixed allowance</span>
                          </span>
                        ) : (
                          <>
                            <span className="text-muted-foreground">
                              Entitled {Number(selectedBalance.entitled)} · Taken{' '}
                              {Number(selectedBalance.taken)} · Pending{' '}
                              {Number(selectedBalance.pending)} ·
                            </span>{' '}
                            <span className="font-semibold text-foreground">Available {available}</span>
                          </>
                        )}
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

                  {/* Weekend / public-holiday warning */}
                  {(startNote || endNote) && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-0.5">
                        {startNote && (
                          <p>
                            Your {isHalfDay ? 'selected date' : 'start date'} ({fmtDayLabel(startDate)}) falls on{' '}
                            {startNote}.
                          </p>
                        )}
                        {endNote && (
                          <p>
                            Your end date ({fmtDayLabel(effectiveEnd)}) falls on {endNote}.
                          </p>
                        )}
                        <p className="text-xs opacity-80">
                          Weekends and public holidays aren&apos;t counted toward your leave balance.
                        </p>
                      </div>
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
                </fieldset>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeApply}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="apply-form"
                disabled={isSubmitting || (available !== null && days > available) || days <= 0}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !cancel.isPending && setPendingCancelConfirm(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SubmitOverlay show={cancel.isPending} label="Cancelling…" />
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
                disabled={cancel.isPending}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={async () => {
                  await cancel.mutateAsync({ id: pendingCancelConfirm.id })
                  setPendingCancelConfirm(null)
                }}
                disabled={cancel.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancel.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {cancel.isPending ? 'Cancelling…' : 'Yes, cancel it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancellation Request Modal ──────────────────────────────── */}
      {cancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !cancel.isPending && setCancelModal(null)}
        >
          <div
            className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SubmitOverlay show={cancel.isPending} label="Submitting…" />
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
                disabled={cancel.isPending}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
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
                disabled={cancel.isPending}
                className={cn(inputCls, 'resize-none disabled:opacity-50')}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCancelModal(null)}
                disabled={cancel.isPending}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Go back
              </button>
              <button
                onClick={submitCancelRequest}
                disabled={!cancelReason.trim() || cancel.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {cancel.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {cancel.isPending ? 'Submitting…' : 'Request Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Edit cancel reason modal ───────────────────────────────── */}
      {editReasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !updateCancelReason.isPending && setEditReasonModal(null)}
        >
          <div
            className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SubmitOverlay show={updateCancelReason.isPending} label="Saving…" />
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Update cancel reason</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  You can update the reason while your cancellation is awaiting manager approval.
                </p>
              </div>
              <button
                onClick={() => setEditReasonModal(null)}
                disabled={updateCancelReason.isPending}
                className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-50"
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
              disabled={updateCancelReason.isPending}
              className={cn(inputCls, 'resize-none disabled:opacity-50')}
              placeholder="Update your cancellation reason…"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditReasonModal(null)}
                disabled={updateCancelReason.isPending}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {updateCancelReason.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {updateCancelReason.isPending ? 'Saving…' : 'Save reason'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
