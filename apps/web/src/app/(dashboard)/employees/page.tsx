'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useEmployees, useUpdateEmployeeById } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useOffices } from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, Card, Avatar, StatusBadge, Spinner, EmptyState } from '@/components/ui/primitives'
import { UserRole, EmploymentStatus } from '@hr-system/types'
import { Plus, Search, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, X, Check } from 'lucide-react'
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

// ─── Inline select cell ───────────────────────────────────────────────────────

function InlineSelect({
  value,
  options,
  saving,
  onSave,
  onCancel,
}: {
  value: string
  options: { value: string; label: string }[]
  saving: boolean
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(value)
  return (
    <div className="flex items-center gap-1">
      <select
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        disabled={saving}
        className="h-7 rounded border bg-background px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={() => onSave(val)}
        disabled={saving || val === value}
        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-900/20"
      >
        {saving ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="rounded p-0.5 hover:bg-muted disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const canEdit  = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HR_MANAGER

  // ── Filters ──
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState('')
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
  const [editCell, setEditCell]   = useState<{ id: string; field: 'status' | 'dept' } | null>(null)
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
      setEditCell(null)
    } finally {
      setSavingCell(null)
    }
  }

  async function saveDept(empId: string, newDeptId: string) {
    const key = `${empId}-dept`
    setSavingCell(key)
    try {
      await updateById.mutateAsync({ id: empId, departmentId: newDeptId })
      setEditCell(null)
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
                  <SortTh label="Office"     field="office"     active={sortField === 'office'}     dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Status"     field="status"     active={sortField === 'status'}     dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => {
                  const isEditingStatus = editCell?.id === emp.id && editCell.field === 'status'
                  const isEditingDept   = editCell?.id === emp.id && editCell.field === 'dept'
                  const isSavingStatus  = savingCell === `${emp.id}-status`
                  const isSavingDept    = savingCell === `${emp.id}-dept`

                  return (
                    <tr key={emp.id} className="group border-b last:border-0 hover:bg-muted/40">
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
                        {isEditingDept ? (
                          <InlineSelect
                            value={emp.department?.id ?? ''}
                            options={deptOptions}
                            saving={isSavingDept}
                            onSave={v => saveDept(emp.id, v)}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span>{emp.department?.name ?? '—'}</span>
                            {canEdit && (
                              <button
                                onClick={() => setEditCell({ id: emp.id, field: 'dept' })}
                                className="invisible rounded p-0.5 text-muted-foreground hover:bg-muted group-hover:visible"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Office */}
                      <td className="px-4 py-2">{emp.office?.code}</td>

                      {/* Status */}
                      <td className="px-4 py-2">
                        {isEditingStatus ? (
                          <InlineSelect
                            value={emp.employmentStatus}
                            options={statusOptions}
                            saving={isSavingStatus}
                            onSave={v => saveStatus(emp.id, v)}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={emp.employmentStatus} />
                            {canEdit && (
                              <button
                                onClick={() => setEditCell({ id: emp.id, field: 'status' })}
                                className="invisible rounded p-0.5 text-muted-foreground hover:bg-muted group-hover:visible"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
