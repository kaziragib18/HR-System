'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  usePayrollRun,
  useProcessPayrollRun,
  useApprovePayrollRun,
  type PayrollEntry,
  type TaxSlab,
} from '@/lib/api/hooks/usePayroll'
import { MarkPaidModal } from '@/components/payroll/MarkPaidModal'
import { Card, StatusBadge, EmptyState, Skeleton, Avatar } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Play, CheckCircle2, Banknote, ChevronDown, ChevronRight,
  ShieldOff, Loader2, Search, X, Users2, FileQuestion,
} from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const PAGE_SIZE = 10

type AttendanceFilter = 'all' | 'full' | 'absences' | 'leave'
type SortKey = 'name' | 'net-desc' | 'net-asc' | 'gross-desc'

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
        <Avatar firstName={entry.employee?.firstName ?? '?'} lastName={entry.employee?.lastName ?? '?'} url={entry.employee?.avatarUrl} size={32} />
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
  const [showMarkPaid, setShowMarkPaid] = useState(false)
  const [entrySearch, setEntrySearch] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [page, setPage] = useState(1)

  const hasActiveFilters = !!(entrySearch || attendanceFilter !== 'all' || sortBy !== 'name')

  function clearEntryFilters() {
    setEntrySearch('')
    setAttendanceFilter('all')
    setSortBy('name')
    setPage(1)
  }

  const filteredEntries = useMemo(() => {
    if (!run) return []
    const q = entrySearch.trim().toLowerCase()
    const list = run.entries.filter((entry: PayrollEntry) => {
      if (q) {
        const matches =
          `${entry.employee?.firstName ?? ''} ${entry.employee?.lastName ?? ''}`.toLowerCase().includes(q) ||
          (entry.employee?.employeeId ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (attendanceFilter === 'full' && entry.presentDays !== entry.workingDays) return false
      if (attendanceFilter === 'absences' && entry.presentDays >= entry.workingDays) return false
      if (attendanceFilter === 'leave' && entry.leaveDays <= 0) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sortBy === 'net-desc') return Number(b.netSalary) - Number(a.netSalary)
      if (sortBy === 'net-asc') return Number(a.netSalary) - Number(b.netSalary)
      if (sortBy === 'gross-desc') return Number(b.grossSalary) - Number(a.grossSalary)
      return `${a.employee?.firstName ?? ''} ${a.employee?.lastName ?? ''}`
        .localeCompare(`${b.employee?.firstName ?? ''} ${b.employee?.lastName ?? ''}`)
    })
  }, [run, entrySearch, attendanceFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageEntries = filteredEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Access restricted"
        message="Only Super Admins can manage payroll runs."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Card className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </Card>
      </div>
    )
  }

  if (!run) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Run not found"
        message="This payroll run doesn't exist, or may have been removed."
      />
    )
  }

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
              {process.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {process.isPending ? 'Processing…' : run.processedAt ? 'Re-process' : 'Process Payroll'}
            </button>
          )}
          {run.status === 'DRAFT' && run.processedAt && (
            <button
              onClick={() => approve.mutate(run.id)}
              disabled={approve.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {approve.isPending ? 'Approving…' : 'Approve'}
            </button>
          )}
          {run.status === 'APPROVED' && (
            <button
              onClick={() => setShowMarkPaid(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Banknote className="h-4 w-4" />
              Mark as Paid
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
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <p className="mr-auto flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users2 className="h-3.5 w-3.5" /> Employee breakdown
          </p>
          {run.entries.length > 0 && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employee…"
                  value={entrySearch}
                  onChange={e => { setEntrySearch(e.target.value); setPage(1) }}
                  className="h-8 w-44 rounded-md border bg-background py-1.5 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {entrySearch && (
                  <button
                    onClick={() => { setEntrySearch(''); setPage(1) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <select
                value={attendanceFilter}
                onChange={e => { setAttendanceFilter(e.target.value as AttendanceFilter); setPage(1) }}
                className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All attendance</option>
                <option value="full">Full attendance</option>
                <option value="absences">Has absences</option>
                <option value="leave">Had leave days</option>
              </select>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as SortKey); setPage(1) }}
                className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="name">Sort: Name (A–Z)</option>
                <option value="net-desc">Sort: Net pay (high–low)</option>
                <option value="net-asc">Sort: Net pay (low–high)</option>
                <option value="gross-desc">Sort: Gross pay (high–low)</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearEntryFilters}
                  className="flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </>
          )}
        </div>
        <div className="p-3">
          {run.entries.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No entries yet"
              message='Click "Process Payroll" to calculate entries for all active employees.'
            />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching employees"
              message={hasActiveFilters ? 'No entries match these filters.' : `No entries match "${entrySearch}".`}
            />
          ) : (
            <div className="space-y-2">
              {pageEntries.map((entry: PayrollEntry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {filteredEntries.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 text-sm">
            <span className="text-xs text-muted-foreground">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'employee' : 'employees'}
              {totalPages > 1 && <> · page {safePage} of {totalPages}</>}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Previous
                </button>
                {pageWindow(safePage, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        'min-w-7 rounded-md border px-2 py-1 text-xs',
                        p === safePage ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {showMarkPaid && <MarkPaidModal run={run} onClose={() => setShowMarkPaid(false)} />}
    </div>
  )
}
