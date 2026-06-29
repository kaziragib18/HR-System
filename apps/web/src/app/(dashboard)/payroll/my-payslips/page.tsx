'use client'

import { useState } from 'react'
import { useMyPayslips, type PayrollEntry, type TaxSlab } from '@/lib/api/hooks/usePayroll'
import { Card, StatusBadge, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Wallet } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function fmt(val: string | number, currency: string): string {
  const n = Number(val)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function PayslipCard({ entry }: { entry: PayrollEntry }) {
  const [open, setOpen] = useState(false)
  const c = entry.currency
  const run = entry.payrollRun!

  const grossNum = Number(entry.grossSalary)
  const netNum = Number(entry.netSalary)
  const taxNum = Number(entry.taxAmount)
  const pfNum = Number(entry.pfContribution)
  const totalDeductions = taxNum + pfNum + Number(entry.deductions)

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {MONTHS[run.month - 1].slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{MONTHS[run.month - 1]} {run.year}</p>
          <p className="text-xs text-muted-foreground">{entry.presentDays}/{entry.workingDays} days present</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-[10px] text-muted-foreground">Gross</p>
            <p className="text-sm">{fmt(entry.grossSalary, c)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Net pay</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(entry.netSalary, c)}</p>
          </div>
          <StatusBadge status={run.status} />
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          {/* Earnings vs Deductions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Earnings</p>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Basic salary', val: fmt(entry.basicSalary, c) },
                  { label: 'Allowances', val: fmt(entry.allowances, c) },
                  ...(Number(entry.overtimePay) > 0 ? [{ label: 'Overtime pay', val: fmt(entry.overtimePay, c) }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.val}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>Gross</span>
                  <span>{fmt(entry.grossSalary, c)}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Deductions</p>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Income tax', val: fmt(entry.taxAmount, c), cls: 'text-amber-600 dark:text-amber-400' },
                  ...(Number(entry.pfContribution) > 0 ? [{ label: 'PF contribution', val: fmt(entry.pfContribution, c), cls: '' }] : []),
                  ...(Number(entry.deductions) > 0 ? [{ label: 'Other deductions', val: fmt(entry.deductions, c), cls: 'text-red-600 dark:text-red-400' }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn('font-medium', row.cls)}>{row.val}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>Total deductions</span>
                  <span className="text-red-600 dark:text-red-400">{fmt(totalDeductions, c)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net pay highlight */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/10 px-4 py-3">
            <span className="text-sm font-semibold">Net pay</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(entry.netSalary, c)}</span>
          </div>

          {/* Tax breakdown */}
          {entry.taxBreakdown?.slabs?.length > 0 && (
            <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
              <p className="mb-2 font-medium text-muted-foreground">{entry.taxBreakdown.regime} breakdown</p>
              <div className="space-y-1">
                {entry.taxBreakdown.slabs
                  .filter((s: TaxSlab) => s.taxAmount > 0)
                  .map((s: TaxSlab, i: number) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{s.label}</span>
                      <span className="font-medium text-foreground">{fmt(s.taxAmount, c)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MyPayslipsPage() {
  const { data: payslips = [], isLoading } = useMyPayslips()

  const latestNet = payslips.length > 0 ? Number(payslips[0].netSalary) : 0
  const latestCurrency = payslips.length > 0 ? payslips[0].currency : 'USD'
  const ytdGross = payslips.reduce((s, p) => s + Number(p.grossSalary), 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Payslips</h1>
        <p className="text-sm text-muted-foreground">Your salary history and tax breakdowns</p>
      </div>

      {/* Stats */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            {
              label: 'Latest net pay',
              value: new Intl.NumberFormat('en-US', { style: 'currency', currency: latestCurrency, maximumFractionDigits: 0 }).format(latestNet),
              cls: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              label: 'YTD gross',
              value: new Intl.NumberFormat('en-US', { style: 'currency', currency: latestCurrency, maximumFractionDigits: 0 }).format(ytdGross),
              cls: 'text-primary',
            },
            { label: 'Payslips', value: payslips.length, cls: 'text-foreground' },
          ].map(s => (
            <Card key={s.label} className="flex flex-col items-center justify-center py-4">
              <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Payslips list */}
      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
        {isLoading ? (
          <Spinner />
        ) : payslips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No payslips available yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Your payslips will appear here once payroll is processed and approved.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(payslips as PayrollEntry[]).map(entry => (
              <PayslipCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
