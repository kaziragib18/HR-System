'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEmployees, useUpdateEmployeeById } from '@/lib/api/hooks/useEmployees'
import { NewEmployeeModal } from '@/components/employees/NewEmployeeModal'
import { useDepartments, departmentLabel } from '@/lib/api/hooks/useDepartments'
import { useOffices, useJobTitles } from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, Card, Avatar, StatusBadge, SubmitOverlay } from '@/components/ui/primitives'
import { UserRole, EmploymentStatus } from '@hr-system/types'
import type { EmployeeListItem } from '@hr-system/types'
import {
  Plus, Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, X, Users, Building2, Landmark,
  AlertTriangle, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'department' | 'office' | 'status'
type SortDir   = 'asc' | 'desc'

// Only elevated roles get a badge — plain employees don't, to avoid noise.
const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN:  { label: 'Super Admin', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  HR_MANAGER:   { label: 'HR Manager',  cls: 'bg-primary/10 text-primary' },
  DEPT_HEAD:    { label: 'Head',        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  DEPT_MANAGER: { label: 'Manager',     cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
}

function RoleBadge({ role }: { role?: string | null }) {
  const b = role ? ROLE_BADGE[role] : null
  if (!b) return null
  return <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', b.cls)}>{b.label}</span>
}

// ─── Sort header button ───────────────────────────────────────────────────────

function SortTh({ label, field, active, dir, onSort }: {
  label: string; field: SortField; active: boolean; dir: SortDir; onSort: (f: SortField) => void
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th className="px-4 py-2.5 font-medium">
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground/50')} />
      </button>
    </th>
  )
}

// ─── Editable select cell — dropdown saves immediately on change ─────────────

function EditableSelect({ value, options, saving, placeholder = '— Select —', onChange }: {
  value: string; options: { value: string; label: string }[]; saving: boolean; placeholder?: string; onChange: (v: string) => void
}) {
  const hasMatch = options.some(o => o.value === value)
  const selectValue = hasMatch ? value : ''
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectValue}
        disabled={saving}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        // pr-7 reserves room for the native dropdown arrow; truncate ellipsizes
        // long option text (e.g. "IT (Web Development)") instead of overlapping it.
        className="h-7 w-full min-w-[7rem] max-w-[12rem] truncate rounded-md border bg-background pl-2 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <option value="" disabled={hasMatch}>{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {saving && <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />}
    </div>
  )
}

// ─── Change-confirmation modals ──────────────────────────────────────────────
// Department, designation, and status are meaningful org changes, not typos to
// shrug off — every select here proposes a change rather than saving it
// immediately; the modal is what actually commits it.

interface PendingDeptChange { emp: EmployeeListItem; newDeptId: string; newDeptName: string }
interface PendingDesignationChange { emp: EmployeeListItem; newJobTitleId: string }
interface PendingStatusChange { emp: EmployeeListItem; newStatus: string }

function DeptChangeModal({ pending, onClose, onConfirm, submitting }: {
  pending: PendingDeptChange
  onClose: () => void
  onConfirm: (newJobTitleId: string) => void
  submitting: boolean
}) {
  const { data: jobTitles = [], isLoading } = useJobTitles(pending.newDeptId)
  const [jobTitleId, setJobTitleId] = useState('')
  const empName = `${pending.emp.firstName} ${pending.emp.lastName}`
  const oldDeptName = pending.emp.department?.name ?? '—'
  // Designation is department-scoped — required to pick a new one when
  // options exist, but don't block the transfer if the new department simply
  // has none configured yet.
  const designationRequired = !isLoading && jobTitles.length > 0
  const canConfirm = !submitting && (!designationRequired || !!jobTitleId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={submitting} label="Saving…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Change department?</p>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <fieldset disabled={submitting} className="contents">
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Move <span className="font-medium text-foreground">{empName}</span> from{' '}
              <span className="font-medium text-foreground">{oldDeptName}</span> to{' '}
              <span className="font-medium text-foreground">{pending.newDeptName}</span>?
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Designations are specific to a department, so their current one no longer applies — pick one for {pending.newDeptName} below.</span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                New designation {designationRequired && <span className="text-destructive">*</span>}
              </label>
              <select
                value={jobTitleId}
                onChange={e => setJobTitleId(e.target.value)}
                disabled={isLoading || jobTitles.length === 0}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="">
                  {isLoading ? 'Loading…' : jobTitles.length === 0 ? 'No designations for this department yet' : 'Select designation…'}
                </option>
                {jobTitles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 border-t px-4 py-3">
            <button onClick={onClose} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(jobTitleId)}
              disabled={!canConfirm}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? 'Saving…' : 'Confirm change'}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

function DesignationChangeModal({ pending, onClose, onConfirm, submitting }: {
  pending: PendingDesignationChange
  onClose: () => void
  onConfirm: () => void
  submitting: boolean
}) {
  const { data: jobTitles = [] } = useJobTitles(pending.emp.department?.id)
  const newName = jobTitles.find(t => t.id === pending.newJobTitleId)?.name ?? '—'
  const empName = `${pending.emp.firstName} ${pending.emp.lastName}`
  const oldName = pending.emp.jobTitle?.name ?? 'No designation'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={submitting} label="Saving…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Change designation?</p>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Change <span className="font-medium text-foreground">{empName}</span>&apos;s designation from{' '}
            <span className="font-medium text-foreground">{oldName}</span> to{' '}
            <span className="font-medium text-foreground">{newName}</span>?
          </p>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Saving…' : 'Confirm change'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusChangeModal({ pending, onClose, onConfirm, submitting }: {
  pending: PendingStatusChange
  onClose: () => void
  onConfirm: () => void
  submitting: boolean
}) {
  const empName = `${pending.emp.firstName} ${pending.emp.lastName}`
  const oldLabel = pending.emp.employmentStatus.replace(/_/g, ' ')
  const newLabel = pending.newStatus.replace(/_/g, ' ')
  const isTerminating = pending.newStatus === 'TERMINATED'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={submitting} label="Saving…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Change status?</p>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Change <span className="font-medium text-foreground">{empName}</span>&apos;s status from{' '}
            <span className="font-medium text-foreground">{oldLabel}</span> to{' '}
            <span className="font-medium text-foreground">{newLabel}</span>?
          </p>
          {isTerminating && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>This deactivates their login and immediately ends all their active sessions.</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50',
              isTerminating ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            )}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Saving…' : 'Confirm change'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Employee row (desktop table) ───────────────────────────────────────────

function EmployeeRow({ emp, canEdit, showOffice, savingCell, deptOptions, statusOptions, onSaveDept, onSaveStatus, onSaveDesignation }: {
  emp: EmployeeListItem
  canEdit: boolean
  showOffice: boolean
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

  const { data: jobTitles = [] } = useJobTitles(canEdit ? emp.department?.id : undefined)
  const designationOptions = jobTitles.map(t => ({ value: t.id, label: t.name }))

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      {/* Employee */}
      <td className="px-4 py-2.5">
        <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
          <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{emp.firstName} {emp.lastName}</span>
              <RoleBadge role={emp.user?.role} />
            </p>
            <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
          </div>
        </Link>
      </td>

      {/* ID */}
      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{emp.employeeId}</td>

      {/* Department */}
      <td className="px-4 py-2.5">
        {canEdit ? (
          <EditableSelect value={emp.department?.id ?? ''} options={deptOptions} saving={isSavingDept} onChange={v => onSaveDept(emp.id, v)} />
        ) : (
          <span>{emp.department?.name ?? '—'}</span>
        )}
      </td>

      {/* Designation */}
      <td className="px-4 py-2.5">
        {canEdit ? (
          <EditableSelect value={emp.jobTitle?.id ?? ''} options={designationOptions} saving={isSavingDesignation} placeholder="No designation" onChange={v => onSaveDesignation(emp.id, v)} />
        ) : (
          <span className="text-muted-foreground">{emp.jobTitle?.name ?? '—'}</span>
        )}
      </td>

      {/* Office */}
      {showOffice && (
        <td className="px-4 py-2.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{emp.office?.code}</span>
        </td>
      )}

      {/* Status */}
      <td className="px-4 py-2.5">
        {canEdit ? (
          <EditableSelect value={emp.employmentStatus} options={statusOptions} saving={isSavingStatus} onChange={v => onSaveStatus(emp.id, v)} />
        ) : (
          <StatusBadge status={emp.employmentStatus} />
        )}
      </td>

      {/* View */}
      <td className="px-2 py-2.5">
        <Link href={`/employees/${emp.id}`} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="View profile">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  )
}

// ─── Employee card (mobile) — read-only; inline editing is desktop-only ───────

function EmployeeCard({ emp, showOffice }: { emp: EmployeeListItem; showOffice: boolean }) {
  return (
    <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 border-b p-3 last:border-0 hover:bg-muted/40">
      <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{emp.firstName} {emp.lastName}</span>
          <RoleBadge role={emp.user?.role} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {emp.jobTitle?.name ?? '—'} · {emp.department?.name ?? '—'}{showOffice ? ` · ${emp.office?.code}` : ''}
        </p>
      </div>
      <StatusBadge status={emp.employmentStatus} />
    </Link>
  )
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const canEdit  = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HR_MANAGER
  const [showNewEmployee, setShowNewEmployee] = useState(false)

  // ── Filters ──
  const searchParams = useSearchParams()
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState(() => searchParams.get('department') ?? '')
  const [officeFilter, setOfficeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Keep the department filter in sync when arriving via a ?department= link
  // (e.g. from a department card) even if the page is already mounted.
  useEffect(() => {
    setDeptFilter(searchParams.get('department') ?? '')
    setPage(1)
  }, [searchParams])

  // ── Sort ──
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Inline edit state ──
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [pendingDeptChange, setPendingDeptChange] = useState<PendingDeptChange | null>(null)
  const [pendingDesignationChange, setPendingDesignationChange] = useState<PendingDesignationChange | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)

  // ── Data ──
  const { data, isLoading } = useEmployees({
    search,
    page,
    limit: 15,
    departmentId: deptFilter || undefined,
    officeId:     officeFilter || undefined,
    employmentStatus: statusFilter || undefined,
  })
  const { data: departments = [] } = useDepartments()
  const { data: offices     = [] } = useOffices()
  const updateById = useUpdateEmployeeById()

  const hasFilters = !!(deptFilter || officeFilter || statusFilter || search)
  function clearFilters() { setSearch(''); setDeptFilter(''); setOfficeFilter(''); setStatusFilter(''); setPage(1) }

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

  // ── Propose handlers — a select never saves directly, it opens a confirm
  // modal; the modal's own confirm button is what actually mutates. ──
  function proposeDept(empId: string, newDeptId: string) {
    const emp = rows.find(r => r.id === empId)
    const newDept = departments.find(d => d.id === newDeptId)
    if (!emp || !newDept || newDeptId === emp.department?.id) return
    setPendingDeptChange({ emp, newDeptId, newDeptName: newDept.name })
  }
  function proposeDesignation(empId: string, newJobTitleId: string) {
    const emp = rows.find(r => r.id === empId)
    if (!emp || newJobTitleId === emp.jobTitle?.id) return
    setPendingDesignationChange({ emp, newJobTitleId })
  }
  function proposeStatus(empId: string, newStatus: string) {
    const emp = rows.find(r => r.id === empId)
    if (!emp || newStatus === emp.employmentStatus) return
    setPendingStatusChange({ emp, newStatus })
  }

  // ── Confirm handlers — do the actual mutation once the modal is confirmed ──
  async function confirmDeptChange(newJobTitleId: string) {
    if (!pendingDeptChange) return
    const { emp, newDeptId } = pendingDeptChange
    setSavingCell(`${emp.id}-dept`)
    try {
      await updateById.mutateAsync({ id: emp.id, departmentId: newDeptId, jobTitleId: newJobTitleId || undefined })
      setPendingDeptChange(null)
    } finally { setSavingCell(null) }
  }
  async function confirmDesignationChange() {
    if (!pendingDesignationChange) return
    const { emp, newJobTitleId } = pendingDesignationChange
    setSavingCell(`${emp.id}-designation`)
    try {
      await updateById.mutateAsync({ id: emp.id, jobTitleId: newJobTitleId })
      setPendingDesignationChange(null)
    } finally { setSavingCell(null) }
  }
  async function confirmStatusChange() {
    if (!pendingStatusChange) return
    const { emp, newStatus } = pendingStatusChange
    setSavingCell(`${emp.id}-status`)
    try {
      await updateById.mutateAsync({ id: emp.id, employmentStatus: newStatus as EmploymentStatus })
      setPendingStatusChange(null)
    } finally { setSavingCell(null) }
  }

  const statusOptions = Object.values(EmploymentStatus).map(v => ({ value: v, label: v.replace(/_/g, ' ') }))
  const deptOptions = departments.map(d => ({ value: d.id, label: departmentLabel(d, departments) }))
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1

  const selectCls = 'h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your organisation's people"
        action={
          canEdit && (
            <button
              onClick={() => setShowNewEmployee(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add employee
            </button>
          )
        }
      />

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryTile icon={Users} label={hasFilters ? 'Matching employees' : 'Employees'} value={total} />
        <SummaryTile icon={Building2} label="Departments" value={departments.length} />
        <SummaryTile icon={Landmark} label={offices.length === 1 ? 'Office' : 'Offices'} value={offices.length} />
      </div>

      <Card className="p-0">
        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search by name, email, or ID…"
              className="h-9 w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }} className={selectCls}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{departmentLabel(d, departments)}</option>)}
          </select>
          {offices.length > 1 && (
            <select value={officeFilter} onChange={e => { setOfficeFilter(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All offices</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className={selectCls}>
            <option value="">All statuses</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex h-9 items-center gap-1 rounded-md border px-2.5 text-sm text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-56 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No employees found</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {hasFilters ? 'No one matches the current filters.' : 'There are no employees to show yet.'}
            </p>
            {hasFilters ? (
              <button onClick={clearFilters} className="mt-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Clear filters</button>
            ) : canEdit ? (
              <button
                onClick={() => setShowNewEmployee(true)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Add employee
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">ID</th>
                    <SortTh label="Department" field="department" active={sortField === 'department'} dir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2.5 font-medium">Designation</th>
                    {offices.length > 1 && (
                      <SortTh label="Office" field="office" active={sortField === 'office'} dir={sortDir} onSort={toggleSort} />
                    )}
                    <SortTh label="Status" field="status" active={sortField === 'status'} dir={sortDir} onSort={toggleSort} />
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(emp => (
                    <EmployeeRow
                      key={emp.id}
                      emp={emp}
                      canEdit={canEdit}
                      showOffice={offices.length > 1}
                      savingCell={savingCell}
                      deptOptions={deptOptions}
                      statusOptions={statusOptions}
                      onSaveDept={proposeDept}
                      onSaveStatus={proposeStatus}
                      onSaveDesignation={proposeDesignation}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {rows.map(emp => <EmployeeCard key={emp.id} emp={emp} showOffice={offices.length > 1} />)}
            </div>
          </>
        )}

        {/* ── Pagination footer ── */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} {total === 1 ? 'employee' : 'employees'}
              {totalPages > 1 && <> · page {data?.meta.page} of {totalPages}</>}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">
                  Previous
                </button>
                {pageWindow(page, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        'min-w-8 rounded-md border px-2.5 py-1',
                        p === page ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {pendingDeptChange && (
        <DeptChangeModal
          pending={pendingDeptChange}
          onClose={() => setPendingDeptChange(null)}
          onConfirm={confirmDeptChange}
          submitting={savingCell === `${pendingDeptChange.emp.id}-dept`}
        />
      )}
      {pendingDesignationChange && (
        <DesignationChangeModal
          pending={pendingDesignationChange}
          onClose={() => setPendingDesignationChange(null)}
          onConfirm={confirmDesignationChange}
          submitting={savingCell === `${pendingDesignationChange.emp.id}-designation`}
        />
      )}
      {pendingStatusChange && (
        <StatusChangeModal
          pending={pendingStatusChange}
          onClose={() => setPendingStatusChange(null)}
          onConfirm={confirmStatusChange}
          submitting={savingCell === `${pendingStatusChange.emp.id}-status`}
        />
      )}
      {showNewEmployee && <NewEmployeeModal onClose={() => setShowNewEmployee(false)} />}
    </div>
  )
}

// Windowed page numbers: 1 … (p-1) p (p+1) … last
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
