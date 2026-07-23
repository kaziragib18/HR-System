'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  usePayrollRuns,
  useCreatePayrollRun,
  useProcessPayrollRun,
  useApprovePayrollRun,
  type PayrollRun,
} from '@/lib/api/hooks/usePayroll'
import { MarkPaidModal } from '@/components/payroll/MarkPaidModal'
import { Card, StatusBadge, EmptyState, Skeleton, SubmitOverlay, PageHeader } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import {
  Plus, Play, CheckCircle2, Banknote, ChevronRight, X, ShieldOff, Loader2,
  FileStack, Hourglass, FolderOpen,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const OFFICE_BADGE: Record<string, string> = {
  BD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  UK: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
}

const STATUS_BORDER: Record<string, string> = {
  DRAFT: 'border-l-muted-foreground/30',
  PROCESSING: 'border-l-sky-500',
  PROCESSED: 'border-l-blue-500',
  APPROVED: 'border-l-amber-500',
  PAID: 'border-l-emerald-500',
}

function fmtAmount(val: string, currency: string): string {
  const n = Number(val)
  if (!n) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function RunActions({ run, onMarkPaid }: { run: PayrollRun; onMarkPaid: (run: PayrollRun) => void }) {
  const process = useProcessPayrollRun()
  const approve = useApprovePayrollRun()

  if (run.status === 'PAID') return null

  return (
    <div className="flex items-center gap-2">
      {run.status === 'DRAFT' && (
        <button
          onClick={(e) => {
            e.preventDefault()
            process.mutate(run.id)
          }}
          disabled={process.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {process.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {process.isPending ? 'Processing…' : run.processedAt ? 'Re-process' : 'Process'}
        </button>
      )}
      {run.status === 'DRAFT' && run.processedAt && (
        <button
          onClick={(e) => {
            e.preventDefault()
            approve.mutate(run.id)
          }}
          disabled={approve.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {approve.isPending ? 'Approving…' : 'Approve'}
        </button>
      )}
      {run.status === 'APPROVED' && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onMarkPaid(run)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Banknote className="h-3.5 w-3.5" />
          Mark Paid
        </button>
      )}
    </div>
  )
}

function CreateRunModal({ onClose }: { onClose: () => void }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const create = useCreatePayrollRun()

  async function handleCreate() {
    await create.mutateAsync({ month, year })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !create.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={create.isPending} label="Creating…" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">New Payroll Run</h3>
          <button onClick={onClose} disabled={create.isPending} className="rounded p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <fieldset disabled={create.isPending} className="contents">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2099}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={create.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </fieldset>
        {create.isError && (
          <p className="mt-2 text-xs text-destructive">
            {(create.error as { response?: { data?: { error?: string } } })?.response?.data
              ?.error ?? 'Failed to create run'}
          </p>
        )}
      </div>
    </div>
  )
}

export default function PayrollPage() {
  const user = useAuthStore((s) => s.user)
  const { data: runs = [], isLoading } = usePayrollRuns()
  const [showCreate, setShowCreate] = useState(false)
  const [markPaidRun, setMarkPaidRun] = useState<PayrollRun | null>(null)
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const years = useMemo(
    () => [...new Set(runs.map((r) => r.year))].sort((a, b) => b - a),
    [runs],
  )
  const hasActiveFilters = !!(yearFilter || statusFilter)
  const filteredRuns = runs.filter((r) =>
    (!yearFilter || String(r.year) === yearFilter) &&
    (!statusFilter || r.status === statusFilter),
  )

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Access restricted"
        message="Only Super Admins can manage payroll runs."
      />
    )
  }

  const totalGross = runs.reduce((s, r) => s + Number(r.totalGross), 0)
  const paid = runs.filter((r) => r.status === 'PAID').length
  const pending = runs.filter((r) => r.status !== 'PAID').length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        description="Manage monthly payroll runs and approvals"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Run
          </button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total runs', value: runs.length, icon: FileStack, cls: 'text-primary' },
          { label: 'Paid', value: paid, icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending', value: pending, icon: Hourglass, cls: 'text-amber-600 dark:text-amber-400' },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col items-center justify-center gap-1 py-4">
            <s.icon className={cn('h-4 w-4', s.cls)} />
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Runs list */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <p className="mr-auto text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All runs {totalGross > 0 && <span className="normal-case text-muted-foreground/70">· {new Intl.NumberFormat('en-US').format(totalGross)} total gross</span>}
          </p>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All statuses</option>
            {['DRAFT', 'APPROVED', 'PAID'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setYearFilter(''); setStatusFilter('') }}
              className="flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div className="p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-4">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No payroll runs yet"
              message='Create a run to start processing payroll for a month.'
            />
          ) : filteredRuns.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No matching runs"
              message="No payroll runs match these filters."
            />
          ) : (
            <div className="space-y-2">
              {(filteredRuns as PayrollRun[]).map((run) => (
                <Link
                  key={run.id}
                  href={`/payroll/${run.id}`}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-l-[3px] p-4 transition hover:bg-muted/40',
                    STATUS_BORDER[run.status] ?? 'border-l-muted-foreground/30',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {MONTHS[run.month - 1]}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {MONTHS[run.month - 1]} {run.year}
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', OFFICE_BADGE[run.office.code] ?? 'bg-muted text-muted-foreground')}>
                          {run.office.code}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.employeeCount} employees · {run.office.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Gross</p>
                      <p className="text-sm font-semibold">
                        {fmtAmount(run.totalGross, run.currency)}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Net</p>
                      <p className="text-sm font-semibold">{fmtAmount(run.totalNet, run.currency)}</p>
                    </div>
                    <StatusBadge status={run.status} />
                    <RunActions run={run} onMarkPaid={setMarkPaidRun} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showCreate && <CreateRunModal onClose={() => setShowCreate(false)} />}
      {markPaidRun && <MarkPaidModal run={markPaidRun} onClose={() => setMarkPaidRun(null)} />}
    </div>
  )
}
