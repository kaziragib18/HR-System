'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEmployees, useUpdateEmployeeById } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useOffices, useJobTitles } from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, Card, Avatar, StatusBadge, Spinner, EmptyState } from '@/components/ui/primitives'
import { UserRole, EmploymentStatus } from '@hr-system/types'
import type { EmployeeListItem } from '@hr-system/types'
import { Plus, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'department' | 'office' | 'status'
type SortDir   = 'asc' | 'desc'

// ─── Sort header button ───────────────────────────────────────────────────────

function SortTh({
  label,
  field,
  active,
  dir,
  onSort,
}: {
  label: string
  field: SortField
  active: boolean
  dir: SortDir
  onSort: (f: SortField) => void
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th className="px-4 py-2 font-medium">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground/50')} />
      </button>
    </th>
  )
}

// ─── Editable select cell — dropdown saves immediately on change ─────────────

function EditableSelect({
  value,
  options,
  saving,
  placeholder = '— Select —',
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  saving: boolean
  placeholder?: string
  onChange: (v: string) => void
}) {
  // If the current value isn't among the loaded options (e.g. the designation
  // belonged to a department the employee was just moved out of), fall back to
  // the placeholder instead of letting the browser silently select the first
  // real option — that would look like a value is set when it isn't.
  const hasMatch = options.some(o => o.value === value)
  const selectValue = hasMatch ? value : ''

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectValue}
        disabled={saving}
        onChange={e => {
          if (e.target.value) onChange(e.target.value)
        }}
        className="h-7 rounded border bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <option value="" disabled={hasMatch}>{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {saving && (
        <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
      )}
    </div>
  )
}

// ─── Employee row ─────────────────────────────────────────────────────────────

function EmployeeRow({
  emp,
  canEdit,
  savingCell,
  deptOptions,
  statusOptions,
  onSaveDept,
  onSaveStatus,
  onSaveDesignation,
}: {
  emp: EmployeeListItem
  canEdit: boolean
  savingCell: string | null
  deptOptions: { value: string; label: string }[]
  statusOptions: { value: string; label: string }[]
  onSaveDept: (empId: string, v: string) => void
  onSaveStatus: (empId: string, v: string) => void
  onSaveDesignation: (empId: string, v: string) => void
}) {
  const isSavingStatus      = savingCell === `${emp.id}-status`
  const isSavingDept        = savingCell === `${emp.id}-dept`
  const isSavingDesignation = savingCell === `${emp.id}-designation`

  // Job titles are scoped to a department, so fetch options for this row's department.
  const { data: jobTitles = [] } = useJobTitles(canEdit ? emp.department?.id : undefined)
  const designationOptions = jobTitles.map(t => ({ value: t.id, label: t.name }))

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      {/* Employee */}
      <td className="px-4 py-2">
        <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
          <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} />
          <div>
            <p className="font-medium">{emp.firstName} {emp.lastName}</p>
            <p className="text-xs text-muted-foreground">{emp.email}</p>
          </div>
        </Link>
      </td>

      {/* ID */}
      <td className="px-4 py-2 text-muted-foreground">{emp.employeeId}</td>

      {/* Department */}
      <td className="px-4 py-2">
        {canEdit ? (
          <EditableSelect
            value={emp.department?.id ?? ''}
            options={deptOptions}
            saving={isSavingDept}
            onChange={v => onSaveDept(emp.id, v)}
          />
        ) : (
          <span>{emp.department?.name ?? '—'}</span>
        )}
      </td>

      {/* Designation */}
      <td className="px-4 py-2">
        {canEdit ? (
          <EditableSelect
            value={emp.jobTitle?.id ?? ''}
            options={designationOptions}
            saving={isSavingDesignation}
            placeholder="No designation"
            onChange={v => onSaveDesignation(emp.id, v)}
          />
        ) : (
          <span className="text-muted-foreground">{emp.jobTitle?.name ?? '—'}</span>
        )}
      </td>

      {/* Office */}
      <td className="px-4 py-2">{emp.office?.code}</td>

      {/* Status */}
      <td className="px-4 py-2">
        {canEdit ? (
          <EditableSelect
            value={emp.employmentStatus}
            options={statusOptions}
            saving={isSavingStatus}
            onChange={v => onSaveStatus(emp.id, v)}
          />
        ) : (
          <StatusBadge status={emp.employmentStatus} />
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const canEdit  = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HR_MANAGER

  // ── Filters ──
  const searchParams = useSearchParams()
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState(() => searchParams.get('department') ?? '')
  const [officeFilter, setOfficeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // ── Sort ──
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ── Inline edit state ──
  const [savingCell, setSavingCell] = useState<string | null>(null)

  // ── Data ──
  const { data, isLoading } = useEmployees({
    search,
    page,
    limit: 20,
    departmentId: deptFilter || undefined,
    officeId:     officeFilter || undefined,
    employmentStatus: statusFilter || undefined,
  })
  const { data: departments = [] } = useDepartments()
  const { data: offices     = [] } = useOffices()
  const updateById = useUpdateEmployeeById()

  // ── Client-side sort on current page ──
  const rows = useMemo(() => {
    const list = [...(data?.data ?? [])]
    if (!sortField) return list
    return list.sort((a, b) => {
      let av = '', bv = ''
      if (sortField === 'department') { av = a.department?.name ?? ''; bv = b.department?.name ?? '' }
      if (sortField === 'office')     { av = a.office?.code ?? '';      bv = b.office?.code ?? '' }
      if (sortField === 'status')     { av = a.employmentStatus ?? '';  bv = b.employmentStatus ?? '' }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [data, sortField, sortDir])

  // ── Inline save handlers ──
  async function saveStatus(empId: string, newStatus: string) {
    const key = `${empId}-status`
    setSavingCell(key)
    try {
      await updateById.mutateAsync({ id: empId, employmentStatus: newStatus as EmploymentStatus })
    } finally {
      setSavingCell(null)
    }
  }

  async function saveDept(empId: string, newDeptId: string) {
    const key = `${empId}-dept`
    setSavingCell(key)
    try {
      await updateById.mutateAsync({ id: empId, departmentId: newDeptId })
    } finally {
      setSavingCell(null)
    }
  }

  async function saveDesignation(empId: string, newJobTitleId: string) {
    const key = `${empId}-designation`
    setSavingCell(key)
    try {
      await updateById.mutateAsync({ id: empId, jobTitleId: newJobTitleId })
    } finally {
      setSavingCell(null)
    }
  }

  const statusOptions = Object.values(EmploymentStatus).map(v => ({
    value: v,
    label: v.replace(/_/g, ' '),
  }))

  const deptOptions = departments.map(d => ({ value: d.id, label: d.name }))

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your organisation's people"
        action={
          <Link
            href="/employees/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add employee
          </Link>
        }
      />

      <Card className="p-0">
        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {/* Search */}
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search by name, email, or ID…"
              className="h-9 w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Office filter */}
          <select
            value={officeFilter}
            onChange={e => { setOfficeFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All offices</option>
            {offices.map(o => (
              <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All statuses</option>
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(deptFilter || officeFilter || statusFilter || search) && (
            <button
              onClick={() => { setSearch(''); setDeptFilter(''); setOfficeFilter(''); setStatusFilter(''); setPage(1) }}
              className="flex h-9 items-center gap-1 rounded-md border px-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* ── Table ── */}
        {isLoading ? (
          <Spinner />
        ) : !rows.length ? (
          <EmptyState message="No employees found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <SortTh label="Department" field="department" active={sortField === 'department'} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2 font-medium">Designation</th>
                  <SortTh label="Office"     field="office"     active={sortField === 'office'}     dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Status"     field="status"     active={sortField === 'status'}     dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <EmployeeRow
                    key={emp.id}
                    emp={emp}
                    canEdit={canEdit}
                    savingCell={savingCell}
                    deptOptions={deptOptions}
                    statusOptions={statusOptions}
                    onSaveDept={saveDept}
                    onSaveStatus={saveStatus}
                    onSaveDesignation={saveDesignation}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Pagination ── */}
      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
