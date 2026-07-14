'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  usePayrollRun,
  useProcessPayrollRun,
  useApprovePayrollRun,
  useMarkPaidPayrollRun,
  type PayrollEntry,
  type TaxSlab,
} from '@/lib/api/hooks/usePayroll'
import { Card, StatusBadge, Spinner, Avatar } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import { ArrowLeft, Play, CheckCircle2, Banknote, ChevronDown, ChevronRight, ShieldOff } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function fmt(val: string | number, currency: string): string {
  const n = Number(val)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}

function TaxBreakdownPanel({ entry }: { entry: PayrollEntry }) {
  const tb = entry.taxBreakdown
  if (!tb?.slabs?.length) return null
  return (
    <div className="mt-2 rounded-md bg-muted/50 p-3 text-xs">
      <p className="mb-2 font-medium">{tb.regime} — taxable income: {fmt(tb.taxableIncome, entry.currency)}</p>
      <div className="space-y-1">
        {tb.slabs.filter((s: TaxSlab) => s.taxAmount > 0).map((s: TaxSlab, i: number) => (
          <div key={i} className="flex justify-between gap-2 text-muted-foreground">
            <span>{s.label} ({fmtPct(s.rate)})</span>
            <span className="font-medium text-foreground">{fmt(s.taxAmount, entry.currency)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
        <span>Annual tax</span>
        <span>{fmt(tb.totalTax, entry.currency)}</span>
      </div>
    </div>
  )
}

function EntryRow({ entry }: { entry: PayrollEntry }) {
  const [open, setOpen] = useState(false)
  const c = entry.currency

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <Avatar firstName={entry.employee?.firstName ?? '?'} lastName={entry.employee?.lastName ?? '?'} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{entry.employee?.firstName} {entry.employee?.lastName}</p>
          <p className="text-xs text-muted-foreground">{entry.employee?.employeeId} · {entry.presentDays}/{entry.workingDays} days</p>
        </div>
        <div className="hidden grid-cols-4 gap-6 sm:grid">
          {[
            { label: 'Gross', val: fmt(entry.grossSalary, c) },
            { label: 'Tax', val: fmt(entry.taxAmount, c), cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'Deductions', val: fmt(entry.deductions, c), cls: 'text-red-600 dark:text-red-400' },
            { label: 'Net', val: fmt(entry.netSalary, c), cls: 'text-emerald-600 dark:text-emerald-400 font-semibold' },
          ].map(col => (
            <div key={col.label} className="text-right">
              <p className="text-[10px] text-muted-foreground">{col.label}</p>
              <p className={cn('text-sm', col.cls)}>{col.val}</p>
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-3 pt-2 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            {[
              { label: 'Basic salary', val: fmt(entry.basicSalary, c) },
              { label: 'Allowances', val: fmt(entry.allowances, c) },
              { label: 'Overtime pay', val: fmt(entry.overtimePay, c) },
              { label: 'Absent deductions', val: fmt(entry.deductions, c), cls: 'text-red-600 dark:text-red-400' },
              { label: 'Monthly tax', val: fmt(entry.taxAmount, c), cls: 'text-amber-600 dark:text-amber-400' },
              { label: 'PF contribution', val: fmt(entry.pfContribution, c) },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={cn('font-medium', row.cls)}>{row.val}</span>
              </div>
            ))}
          </div>
          <TaxBreakdownPanel entry={entry} />
        </div>
      )}
    </div>
  )
}

export default function PayrollRunPage() {
  const params = useParams()
  const id = params.id as string
  const user = useAuthStore(s => s.user)
  const { data: run, isLoading } = usePayrollRun(id)
  const process = useProcessPayrollRun()
  const approve = useApprovePayrollRun()
  const markPaid = useMarkPaidPayrollRun()

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">Access restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">Only Super Admins can manage payroll runs.</p>
      </div>
    )
  }

  if (isLoading) return <Spinner />
  if (!run) return <p className="text-sm text-muted-foreground">Run not found.</p>

  const c = run.currency

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/payroll" className="rounded-lg border p-2 hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{MONTHS[run.month - 1]} {run.year}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-sm text-muted-foreground">{run.office.name} · {run.employeeCount} employees</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'DRAFT' && (
            <button
              onClick={() => process.mutate(run.id)}
              disabled={process.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {process.isPending ? 'Processing…' : run.processedAt ? 'Re-process' : 'Process Payroll'}
            </button>
          )}
          {run.status === 'DRAFT' && run.processedAt && (
            <button
              onClick={() => approve.mutate(run.id)}
              disabled={approve.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {approve.isPending ? 'Approving…' : 'Approve'}
            </button>
          )}
          {run.status === 'APPROVED' && (
            <button
              onClick={() => { if (confirm('Mark payroll as paid? This will notify all employees.')) markPaid.mutate(run.id) }}
              disabled={markPaid.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" />
              {markPaid.isPending ? 'Marking…' : 'Mark as Paid'}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total gross', val: fmt(run.totalGross, c), cls: 'text-primary' },
          { label: 'Total tax', val: fmt(run.totalTax, c), cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total net', val: fmt(run.totalNet, c), cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Employees', val: run.employeeCount, cls: 'text-foreground' },
        ].map(s => (
          <Card key={s.label} className="flex flex-col items-center justify-center py-4">
            <p className={cn('text-xl font-bold', s.cls)}>{s.val}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Entries */}
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Employee breakdown
        </p>
        {run.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground">No entries yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Click "Process Payroll" to calculate entries for all active employees.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {run.entries.map((entry: PayrollEntry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
