'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  usePayrollRuns,
  useCreatePayrollRun,
  useProcessPayrollRun,
  useApprovePayrollRun,
  useMarkPaidPayrollRun,
  type PayrollRun,
} from '@/lib/api/hooks/usePayroll'
import { Card, StatusBadge, Spinner, SubmitOverlay } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import { Plus, Play, CheckCircle2, Banknote, ChevronRight, X, ShieldOff, Loader2 } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtAmount(val: string, currency: string): string {
  const n = Number(val)
  if (!n) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function RunActions({ run }: { run: PayrollRun }) {
  const process = useProcessPayrollRun()
  const approve = useApprovePayrollRun()
  const markPaid = useMarkPaidPayrollRun()

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
          <Play className="h-3.5 w-3.5" />
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
          <CheckCircle2 className="h-3.5 w-3.5" />
          {approve.isPending ? 'Approving…' : 'Approve'}
        </button>
      )}
      {run.status === 'APPROVED' && (
        <button
          onClick={(e) => {
            e.preventDefault()
            if (confirm('Mark this payroll as paid?')) markPaid.mutate(run.id)
          }}
          disabled={markPaid.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Banknote className="h-3.5 w-3.5" />
          {markPaid.isPending ? 'Marking…' : 'Mark Paid'}
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

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">Access restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Only Super Admins can manage payroll runs.
        </p>
      </div>
    )
  }

  const totalGross = runs.reduce((s, r) => s + Number(r.totalGross), 0)
  const paid = runs.filter((r) => r.status === 'PAID').length
  const pending = runs.filter((r) => r.status !== 'PAID').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage monthly payroll runs and approvals</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Run
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total runs', value: runs.length, cls: 'text-primary' },
          { label: 'Paid', value: paid, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending', value: pending, cls: 'text-amber-600 dark:text-amber-400' },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col items-center justify-center py-4">
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Runs list */}
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          All runs
        </p>
        {isLoading ? (
          <Spinner />
        ) : runs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground">No payroll runs yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a run to start processing payroll for a month.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(runs as PayrollRun[]).map((run) => (
              <Link
                key={run.id}
                href={`/payroll/${run.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {MONTHS[run.month - 1]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {MONTHS[run.month - 1]} {run.year}
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
                  <RunActions run={run} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {showCreate && <CreateRunModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
