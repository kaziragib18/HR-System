'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useEmployees, useEmployee } from '@/lib/api/hooks/useEmployees'
import { useDepartments, departmentLabel } from '@/lib/api/hooks/useDepartments'
import { useOffices } from '@/lib/api/hooks/useReference'
import {
  useEmployeeSalary,
  useSalaryHistory,
  useCreateSalaryStructure,
  type SalaryStructure,
  type SalaryComponent,
} from '@/lib/api/hooks/useSalary'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import type { EmployeeListItem } from '@hr-system/types'
import { Card, Avatar, PageHeader, Skeleton, SubmitOverlay } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ShieldOff, Search, Plus, Trash2, X, Copy,
  ChevronDown, ChevronRight, DollarSign, AlertCircle,
  History, TrendingUp, TrendingDown, CalendarDays, UserX, Loader2,
  ArrowUp, ArrowDown, SlidersHorizontal, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function computeGross(basic: number, components: SalaryComponent[]) {
  let allowances = 0, deductions = 0
  for (const c of components) {
    const amt = c.isPercentage ? (basic * c.amount) / 100 : c.amount
    if (c.type === 'ALLOWANCE') allowances += amt
    else deductions += amt
  }
  return { gross: basic + allowances - deductions, allowances, deductions }
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function IconEmpty({ icon: Icon, title, message, dashed }: {
  icon: LucideIcon; title: string; message?: string; dashed?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-14 text-center', dashed && 'rounded-lg border border-dashed')}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="max-w-xs text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}

// ── Salary Card ──────────────────────────────────────────────────────────────

function SalaryCard({ structure, previous }: { structure: SalaryStructure; previous?: SalaryStructure }) {
  const isInherited = structure.employeeId === null
  const basic = Number(structure.basicSalary)
  const { gross, allowances, deductions } = computeGross(basic, structure.components)
  const c = structure.currency

  const delta = (() => {
    if (!previous) return null
    const prevBasic = Number(previous.basicSalary)
    const { gross: prevGross } = computeGross(prevBasic, previous.components)
    const diff = gross - prevGross
    if (Math.abs(diff) < 0.5) return null
    const pct = prevGross !== 0 ? (diff / prevGross) * 100 : 0
    return { diff, pct, up: diff > 0 }
  })()

  return (
    <div className="overflow-hidden rounded-xl border">
      {/* Hero: gross pay */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gross pay</p>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums text-primary">{fmt(gross, c)}</p>
            {delta && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                delta.up
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
              )}>
                {delta.up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                {delta.pct >= 0 ? '+' : ''}{delta.pct.toFixed(1)}% since last change
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
            isInherited
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
          )}>
            {isInherited ? `Default · ${structure.jobGrade?.name ?? 'job grade'}` : 'Employee-specific'}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {fmtDate(structure.effectiveFrom)}{structure.effectiveTo ? ` – ${fmtDate(structure.effectiveTo)}` : ' – present'}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Basic', val: fmt(basic, c), icon: DollarSign, cls: 'text-foreground' },
            { label: 'Allowances', val: `+${fmt(allowances, c)}`, icon: TrendingUp, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Deductions', val: deductions > 0 ? `-${fmt(deductions, c)}` : '—', icon: TrendingDown, cls: 'text-red-600 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-muted/40 px-2.5 py-2.5 text-center">
              <s.icon className={cn('mx-auto h-3.5 w-3.5', s.cls)} />
              <p className={cn('mt-1 text-sm font-semibold tabular-nums', s.cls)}>{s.val}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {structure.components.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            {structure.components.map((comp, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold',
                    comp.type === 'ALLOWANCE'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
                  )}>
                    {comp.type === 'ALLOWANCE' ? '+' : '−'}
                  </span>
                  <span className="truncate">{comp.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {comp.isPercentage ? `${comp.amount}% of basic` : fmt(comp.amount, c)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── History timeline ─────────────────────────────────────────────────────────

function HistoryTimeline({ items }: { items: SalaryStructure[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="relative space-y-2.5 pl-5">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
      {items.map((s, i) => {
        const isOpen = expandedId === s.id
        const basic = Number(s.basicSalary)
        const { gross } = computeGross(basic, s.components)
        return (
          <div key={s.id} className="relative">
            <span className={cn(
              'absolute -left-5 top-3 h-3 w-3 rounded-full border-2 border-card',
              i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
            )} />
            <button
              onClick={() => setExpandedId(isOpen ? null : s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {fmtDate(s.effectiveFrom)}{s.effectiveTo ? ` – ${fmtDate(s.effectiveTo)}` : ' – present'}
                  {i === 0 && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Latest</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.employeeId === null ? `Default · ${s.jobGrade?.name ?? 'job grade'}` : 'Employee-specific'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{fmt(gross, s.currency)}</span>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {isOpen && <div className="mt-2"><SalaryCard structure={s} previous={items[i + 1]} /></div>}
          </div>
        )
      })}
    </div>
  )
}

// ── New / Duplicate Salary Structure modal ──────────────────────────────────────

interface ComponentRow {
  name: string
  type: 'ALLOWANCE' | 'DEDUCTION'
  amount: string
  isPercentage: boolean
}

const emptyRow = (): ComponentRow => ({ name: '', type: 'ALLOWANCE', amount: '', isPercentage: false })

function SalaryFormModal({
  employeeId,
  officeCurrency,
  officeName,
  duplicateFrom,
  onClose,
  onSuccess,
}: {
  employeeId: string
  officeCurrency: string
  officeName: string
  duplicateFrom?: SalaryStructure | null
  onClose: () => void
  onSuccess: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [basicSalary, setBasicSalary] = useState(duplicateFrom ? String(Number(duplicateFrom.basicSalary)) : '')
  const currency = officeCurrency  // locked to the employee's office currency
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [effectiveTo, setEffectiveTo] = useState('')
  const [components, setComponents] = useState<ComponentRow[]>(
    duplicateFrom
      ? duplicateFrom.components.map(c => ({ name: c.name, type: c.type, amount: String(c.amount), isPercentage: c.isPercentage }))
      : []
  )
  const create = useCreateSalaryStructure()
  const isPending = create.isPending

  const addComponent = () => setComponents(c => [...c, emptyRow()])
  const removeComponent = (i: number) => setComponents(c => c.filter((_, idx) => idx !== i))
  const updateComponent = (i: number, field: keyof ComponentRow, value: string | boolean) =>
    setComponents(c => c.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  const basic = parseFloat(basicSalary) || 0
  const parsedComponents: SalaryComponent[] = components
    .filter(c => c.name.trim() && c.amount)
    .map(c => ({ name: c.name.trim(), type: c.type, amount: parseFloat(c.amount), isPercentage: c.isPercentage }))
  const { gross, allowances, deductions } = computeGross(basic, parsedComponents)

  async function handleSubmit() {
    if (!basic || !effectiveFrom) return
    await create.mutateAsync({
      employeeId,
      basicSalary: basic,
      currency,
      components: parsedComponents,
      effectiveFrom,
      ...(effectiveTo ? { effectiveTo } : {}),
    })
    onSuccess()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border bg-card shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <SubmitOverlay show={isPending} label="Saving structure…" />
        <div className="flex items-start justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{duplicateFrom ? 'Duplicate & Adjust Structure' : 'New Salary Structure'}</p>
            {duplicateFrom && (
              <p className="mt-0.5 text-xs text-muted-foreground">Prefilled from the current structure — set a new effective date.</p>
            )}
          </div>
          <button onClick={onClose} disabled={isPending} className="shrink-0 rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <fieldset disabled={isPending} className="contents">
          <div className="scrollbar-thin space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Basic Salary *</label>
                <input
                  type="number"
                  min={0}
                  value={basicSalary}
                  onChange={e => setBasicSalary(e.target.value)}
                  placeholder="e.g. 60000"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Currency</label>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{currency}</span>
                  <span>·</span>
                  <span>{officeName} office</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Effective From *</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Effective To (optional)</label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={e => setEffectiveTo(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Components */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Components</p>
                <button
                  type="button"
                  onClick={addComponent}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add component
                </button>
              </div>
              {components.length === 0 ? (
                <button
                  type="button"
                  onClick={addComponent}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> No components — basic salary only. Add one?
                </button>
              ) : (
                <div className="space-y-2">
                  {components.map((row, i) => (
                    <div key={i} className="grid grid-cols-1 items-center gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_120px_100px_auto_auto]">
                      <input
                        type="text"
                        placeholder="Component name"
                        value={row.name}
                        onChange={e => updateComponent(i, 'name', e.target.value)}
                        className="min-w-0 rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <select
                        value={row.type}
                        onChange={e => updateComponent(i, 'type', e.target.value)}
                        className="rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="ALLOWANCE">Allowance</option>
                        <option value="DEDUCTION">Deduction</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        placeholder="Amount"
                        value={row.amount}
                        onChange={e => updateComponent(i, 'amount', e.target.value)}
                        className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={row.isPercentage}
                          onChange={e => updateComponent(i, 'isPercentage', e.target.checked)}
                          className="h-3.5 w-3.5"
                        />
                        % of basic
                      </label>
                      <button
                        type="button"
                        onClick={() => removeComponent(i)}
                        className="justify-self-end rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gross preview */}
            {basic > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Preview:</span>
                <span>{fmt(basic, currency)} basic</span>
                {allowances > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">+{fmt(allowances, currency)} allowances</span>
                )}
                {deductions > 0 && (
                  <span className="text-red-600 dark:text-red-400">−{fmt(deductions, currency)} deductions</span>
                )}
                <span className="font-semibold text-primary">= {fmt(gross, currency)} gross</span>
              </div>
            )}

            {create.isError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {(create.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save salary structure'}
              </p>
            )}
          </div>

          <div className="flex gap-2 border-t px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!basic || !effectiveFrom || isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isPending ? 'Saving…' : 'Save Structure'}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'history'
type ModalState = { mode: 'new' } | { mode: 'duplicate'; structure: SalaryStructure } | null

export default function SalaryPage() {
  const user = useAuthStore(s => s.user)
  const searchParams = useSearchParams()
  const router = useRouter()

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [officeFilter, setOfficeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<EmployeeListItem | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [modal, setModal] = useState<ModalState>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Deep-link the selected employee (?employee=<id>) so a refresh or a shared
  // link lands back on the same person — hydrate from a direct fetch since
  // they may not be in the currently-typed search results at all.
  const employeeIdParam = searchParams.get('employee')
  const { data: hydratedEmp } = useEmployee(!selectedEmp && employeeIdParam ? employeeIdParam : '')
  useEffect(() => {
    if (hydratedEmp && !selectedEmp) setSelectedEmp(hydratedEmp)
  }, [hydratedEmp, selectedEmp])

  const { data: departments = [] } = useDepartments()
  const { data: offices = [] } = useOffices()

  const hasActiveFilters = !!(deptFilter || officeFilter)
  const { data: empData, isLoading: empLoading } = useEmployees({
    search: debouncedSearch || undefined,
    departmentId: deptFilter || undefined,
    officeId: officeFilter || undefined,
    limit: 20,
  })
  const employees = empData?.data ?? []

  function clearFilters() {
    setDeptFilter('')
    setOfficeFilter('')
  }

  const {
    data: currentSalary,
    isLoading: salaryLoading,
    isError: salaryError,
    error: salaryErr,
  } = useEmployeeSalary(selectedEmp?.id ?? null)

  const { data: historyData = [] } = useSalaryHistory(selectedEmp?.id ?? null)

  const hasNoSalary = salaryError && (salaryErr as { response?: { status?: number } })?.response?.status === 404

  // The immediately-preceding structure, so "Current salary" can show a
  // raise/change indicator relative to what it replaced.
  const previousStructure = currentSalary
    ? historyData.find(s => s.id !== currentSalary.id && new Date(s.effectiveFrom) < new Date(currentSalary.effectiveFrom))
    : undefined

  function selectEmployee(emp: EmployeeListItem) {
    if (emp.id === selectedEmp?.id) return
    setSelectedEmp(emp)
    setTab('overview')
    router.replace(`/salary?employee=${emp.id}`, { scroll: false })
  }

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <IconEmpty
        icon={ShieldOff}
        title="Access restricted"
        message="Only Super Admins can manage salary structures."
      />
    )
  }

  const officeCurrency = selectedEmp?.office.currency ?? 'BDT'

  return (
    <div>
      <PageHeader title="Salary Management" description="Search for an employee to view or update their salary structure" />

      <div className="grid gap-4 md:grid-cols-[380px_1fr] md:items-start">
        {/* ── Left: Employee browser ── */}
        <div className="md:sticky md:top-4">
          <Card className="!p-0 overflow-hidden">
            {/* Search + filter toggle */}
            <div className="space-y-2.5 border-b p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search employees…"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {searchInput && (
                    <button
                      onClick={() => setSearchInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  title="Filters"
                  className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    showFilters || hasActiveFilters
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              </div>

              {showFilters && (
                <div className="space-y-2">
                  <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">All departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{departmentLabel(d, departments)}</option>)}
                  </select>
                  {offices.length > 1 && (
                    <select
                      value={officeFilter}
                      onChange={e => setOfficeFilter(e.target.value)}
                      className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">All offices</option>
                      {offices.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                    </select>
                  )}
                </div>
              )}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Result count */}
            <div className="flex items-center gap-1.5 border-b bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              {empLoading ? 'Loading…' : `${employees.length} employee${employees.length === 1 ? '' : 's'}`}
            </div>

            {/* List */}
            <div className="scrollbar-thin max-h-[calc(100vh-24rem)] overflow-y-auto p-2">
              {empLoading ? (
                <div className="space-y-1 p-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-2">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-36" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : employees.length === 0 ? (
                <IconEmpty
                  icon={debouncedSearch || hasActiveFilters ? UserX : Search}
                  title={debouncedSearch || hasActiveFilters ? 'No employees found' : 'No employees yet'}
                  message={
                    debouncedSearch
                      ? `No matches for "${debouncedSearch}".`
                      : hasActiveFilters
                        ? 'No employees match these filters.'
                        : 'Employees will appear here once added.'
                  }
                />
              ) : (
                <div className="space-y-0.5">
                  {employees.map(emp => {
                    const isSelected = selectedEmp?.id === emp.id
                    return (
                      <button
                        key={emp.id}
                        onClick={() => selectEmployee(emp)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className={cn('truncate text-xs', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {emp.employeeId} · {emp.department.name}
                          </p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                        )}>
                          {emp.office.code}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: Salary detail ── */}
        <div>
          {!selectedEmp ? (
            <Card>
              <IconEmpty
                icon={DollarSign}
                title="No employee selected"
                message="Search and click an employee on the left to manage their salary."
              />
            </Card>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedEmp.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Employee identity */}
                <Card className="flex flex-wrap items-center gap-4">
                  <Avatar firstName={selectedEmp.firstName} lastName={selectedEmp.lastName} url={selectedEmp.avatarUrl} size={48} />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold">{selectedEmp.firstName} {selectedEmp.lastName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmp.employeeId} · {selectedEmp.department.name} · {selectedEmp.office.name}
                    </p>
                    {selectedEmp.jobGrade && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{selectedEmp.jobGrade.name}</p>
                    )}
                  </div>
                </Card>

                <Tabs
                  items={[
                    { key: 'overview', label: 'Overview' },
                    { key: 'history', label: `History${historyData.length ? ` (${historyData.length})` : ''}` },
                  ]}
                  active={tab}
                  onChange={k => setTab(k as DetailTab)}
                />

                {tab === 'overview' && (
                  <Card>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Current salary
                      </p>
                      <div className="flex gap-2">
                        {currentSalary && (
                          <button
                            onClick={() => setModal({ mode: 'duplicate', structure: currentSalary })}
                            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate & Adjust
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ mode: 'new' })}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                        >
                          <Plus className="h-3.5 w-3.5" /> Set New Structure
                        </button>
                      </div>
                    </div>
                    {salaryLoading ? (
                      <div className="overflow-hidden rounded-xl border">
                        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                          <div className="space-y-1.5">
                            <Skeleton className="h-2.5 w-16" />
                            <Skeleton className="h-6 w-28" />
                          </div>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 rounded-lg" />
                          ))}
                        </div>
                      </div>
                    ) : hasNoSalary ? (
                      <IconEmpty
                        icon={AlertCircle}
                        title="No salary structure found"
                        message='Use "Set New Structure" above to add one for this employee.'
                        dashed
                      />
                    ) : currentSalary ? (
                      <SalaryCard structure={currentSalary} previous={previousStructure} />
                    ) : null}
                  </Card>
                )}

                {tab === 'history' && (
                  <Card>
                    {historyData.length === 0 ? (
                      <IconEmpty
                        icon={History}
                        title="No salary history yet"
                        message="Employee-specific structures you create for this person will appear here."
                      />
                    ) : (
                      <HistoryTimeline items={historyData} />
                    )}
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {modal && selectedEmp && (
        <SalaryFormModal
          employeeId={selectedEmp.id}
          officeCurrency={officeCurrency}
          officeName={selectedEmp.office.name}
          duplicateFrom={modal.mode === 'duplicate' ? modal.structure : null}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); setTab('overview') }}
        />
      )}
    </div>
  )
}
