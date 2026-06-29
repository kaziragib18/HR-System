'use client'

import { useState, useEffect } from 'react'
import { useEmployees } from '@/lib/api/hooks/useEmployees'
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
import { Card, Spinner, Avatar } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  ShieldOff, Search, Plus, Trash2, X,
  ChevronDown, ChevronRight, DollarSign, AlertCircle,
} from 'lucide-react'

const OFFICE_CURRENCY: Record<string, string> = { BD: 'BDT', UK: 'GBP' }

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

// ── Salary Card ──────────────────────────────────────────────────────────────

function SalaryCard({ structure }: { structure: SalaryStructure }) {
  const isInherited = structure.employeeId === null
  const basic = Number(structure.basicSalary)
  const { gross, allowances, deductions } = computeGross(basic, structure.components)
  const c = structure.currency

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          isInherited
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
        )}>
          {isInherited ? `Default — ${structure.jobGrade?.name ?? 'job grade'}` : 'Employee-specific'}
        </span>
        <span className="text-xs text-muted-foreground">
          From {fmtDate(structure.effectiveFrom)}
          {structure.effectiveTo && ` · to ${fmtDate(structure.effectiveTo)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Basic', val: fmt(basic, c), cls: '' },
          { label: 'Allowances', val: `+${fmt(allowances, c)}`, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Deductions', val: deductions > 0 ? `-${fmt(deductions, c)}` : '—', cls: 'text-red-600 dark:text-red-400' },
          { label: 'Gross', val: fmt(gross, c), cls: 'font-semibold text-primary' },
        ].map(s => (
          <div key={s.label} className="text-center rounded-lg bg-muted/40 px-2 py-2">
            <p className={cn('text-sm font-medium', s.cls)}>{s.val}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {structure.components.length > 0 && (
        <div className="border-t pt-2 space-y-1.5">
          {structure.components.map((comp, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded',
                  comp.type === 'ALLOWANCE'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
                )}>
                  {comp.type === 'ALLOWANCE' ? '+' : '−'}
                </span>
                <span className="text-sm">{comp.name}</span>
              </div>
              <span className="text-muted-foreground text-xs">
                {comp.isPercentage ? `${comp.amount}% of basic` : fmt(comp.amount, c)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Salary Form ──────────────────────────────────────────────────────────

interface ComponentRow {
  name: string
  type: 'ALLOWANCE' | 'DEDUCTION'
  amount: string
  isPercentage: boolean
}

const emptyRow = (): ComponentRow => ({ name: '', type: 'ALLOWANCE', amount: '', isPercentage: false })

function AddSalaryForm({
  employeeId,
  officeCurrency,
  onSuccess,
  onCancel,
}: {
  employeeId: string
  officeCurrency: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [basicSalary, setBasicSalary] = useState('')
  const currency = officeCurrency  // locked to employee's office — BD→BDT, UK→GBP
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [effectiveTo, setEffectiveTo] = useState('')
  const [components, setComponents] = useState<ComponentRow[]>([])
  const create = useCreateSalaryStructure()

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
    <div className="space-y-4">
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
            <span>{currency === 'BDT' ? 'Bangladeshi Taka (BD office)' : 'British Pound (UK office)'}</span>
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
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Add component
          </button>
        </div>
        {components.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No components — basic salary only.</p>
        ) : (
          <div className="space-y-2">
            {components.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Component name"
                  value={row.name}
                  onChange={e => updateComponent(i, 'name', e.target.value)}
                  className="min-w-[120px] flex-1 rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-24 rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

      <div className="flex gap-2 border-t pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!basic || !effectiveFrom || create.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? 'Saving…' : 'Save Structure'}
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SalaryPage() {
  const user = useAuthStore(s => s.user)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<EmployeeListItem | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: empData } = useEmployees({ search: debouncedSearch || undefined, limit: 20 })
  const employees = empData?.data ?? []

  const {
    data: currentSalary,
    isLoading: salaryLoading,
    isError: salaryError,
    error: salaryErr,
  } = useEmployeeSalary(selectedEmp?.id ?? null)

  const { data: historyData = [] } = useSalaryHistory(selectedEmp?.id ?? null)

  const hasNoSalary = salaryError && (salaryErr as { response?: { status?: number } })?.response?.status === 404

  function selectEmployee(emp: EmployeeListItem) {
    if (emp.id === selectedEmp?.id) return
    setSelectedEmp(emp)
    setShowForm(false)
    setShowHistory(false)
  }

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">Access restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">Only Super Admins can manage salary structures.</p>
      </div>
    )
  }

  const officeCurrency = selectedEmp ? (OFFICE_CURRENCY[selectedEmp.office.code] ?? 'BDT') : 'BDT'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Salary Management</h1>
        <p className="text-sm text-muted-foreground">Search for an employee to view or update their salary structure</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        {/* ── Left: Employee search ── */}
        <div className="space-y-3">
          <Card className="!p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </Card>

          <Card className="!p-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {employees.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {debouncedSearch ? 'No employees found.' : 'Start typing to search.'}
              </div>
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
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} size={32} />
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
          </Card>
        </div>

        {/* ── Right: Salary detail ── */}
        <div>
          {!selectedEmp ? (
            <Card className="flex flex-col items-center justify-center py-24 text-center">
              <DollarSign className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">No employee selected</p>
              <p className="mt-1 text-sm text-muted-foreground">Search and click an employee on the left to manage their salary.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Employee header */}
              <Card className="flex flex-wrap items-center gap-4">
                <Avatar firstName={selectedEmp.firstName} lastName={selectedEmp.lastName} size={48} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold">{selectedEmp.firstName} {selectedEmp.lastName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedEmp.employeeId} · {selectedEmp.department.name} · {selectedEmp.office.name}
                  </p>
                  {selectedEmp.jobGrade && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{selectedEmp.jobGrade.name}</p>
                  )}
                </div>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" /> Set New Structure
                  </button>
                )}
              </Card>

              {/* Current salary */}
              <Card>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current salary
                </p>
                {salaryLoading ? (
                  <Spinner />
                ) : hasNoSalary ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    No salary structure found for this employee. Use "Set New Structure" to add one.
                  </div>
                ) : currentSalary ? (
                  <SalaryCard structure={currentSalary} />
                ) : null}
              </Card>

              {/* Add new salary form */}
              {showForm && (
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">New Salary Structure</p>
                    <button
                      onClick={() => setShowForm(false)}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <AddSalaryForm
                    employeeId={selectedEmp.id}
                    officeCurrency={officeCurrency}
                    onSuccess={() => { setShowForm(false); setShowHistory(true) }}
                    onCancel={() => setShowForm(false)}
                  />
                </Card>
              )}

              {/* Salary history */}
              {historyData.length > 0 && (
                <Card>
                  <button
                    onClick={() => setShowHistory(v => !v)}
                    className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    <span>Salary history ({historyData.length})</span>
                    {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {showHistory && (
                    <div className="mt-3 space-y-2">
                      {historyData.map((s: SalaryStructure) => (
                        <SalaryCard key={s.id} structure={s} />
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
