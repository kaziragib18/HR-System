'use client'

import { useMemo, useState } from 'react'
import { useMyPayslips, type PayrollEntry, type TaxSlab } from '@/lib/api/hooks/usePayroll'
import { Card, StatusBadge, EmptyState, Skeleton, PageHeader } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Wallet, TrendingUp, FileStack, X } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function fmt(val: string | number, currency: string): string {
  const n = Number(val)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function PayslipCard({ entry, isLatest }: { entry: PayrollEntry; isLatest?: boolean }) {
  const [open, setOpen] = useState(false)
  const c = entry.currency
  const run = entry.payrollRun!

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
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {MONTHS[run.month - 1]} {run.year}
            {isLatest && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Latest</span>}
          </p>
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
  const [yearFilter, setYearFilter] = useState('')

  const years = useMemo(
    () => [...new Set(payslips.map(p => p.payrollRun!.year))].sort((a, b) => b - a),
    [payslips],
  )
  const filtered = yearFilter ? payslips.filter(p => String(p.payrollRun!.year) === yearFilter) : payslips

  const latestNet = payslips.length > 0 ? Number(payslips[0].netSalary) : 0
  const latestCurrency = payslips.length > 0 ? payslips[0].currency : 'USD'
  const ytdYear = payslips.length > 0 ? payslips[0].payrollRun!.year : new Date().getFullYear()
  const ytdGross = payslips
    .filter(p => p.payrollRun!.year === ytdYear)
    .reduce((s, p) => s + Number(p.grossSalary), 0)

  return (
    <div className="space-y-4">
      <PageHeader title="My Payslips" description="Your salary history and tax breakdowns" />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : payslips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            {
              label: 'Latest net pay',
              value: new Intl.NumberFormat('en-US', { style: 'currency', currency: latestCurrency, maximumFractionDigits: 0 }).format(latestNet),
              icon: Wallet,
              cls: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              label: `${ytdYear} gross`,
              value: new Intl.NumberFormat('en-US', { style: 'currency', currency: latestCurrency, maximumFractionDigits: 0 }).format(ytdGross),
              icon: TrendingUp,
              cls: 'text-primary',
            },
            { label: 'Payslips', value: payslips.length, icon: FileStack, cls: 'text-foreground' },
          ].map(s => (
            <Card key={s.label} className="flex flex-col items-center justify-center gap-1 py-4">
              <s.icon className={cn('h-4 w-4', s.cls)} />
              <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Payslips list */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <p className="mr-auto text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
          {years.length > 1 && (
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {yearFilter && (
            <button
              onClick={() => setYearFilter('')}
              className="flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : payslips.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payslips available yet"
              message="Your payslips will appear here once payroll is processed and approved."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payslips this year"
              message={`No payslips found for ${yearFilter}.`}
            />
          ) : (
            <div className="space-y-2">
              {(filtered as PayrollEntry[]).map((entry, i) => (
                <PayslipCard key={entry.id} entry={entry} isLatest={i === 0 && !yearFilter} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
