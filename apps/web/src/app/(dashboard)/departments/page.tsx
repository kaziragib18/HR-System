'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useAppointDeptRole,
  useDismissDeptRole,
  useDepartmentMembers,
  type Department,
} from '@/lib/api/hooks/useDepartments'
import {
  useCreateJobTitle,
  useUpdateJobTitle,
  useDeleteJobTitle,
} from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { Card, Spinner, Avatar } from '@/components/ui/primitives'
import { SidePanel } from '@/components/ui/side-panel'
import { UserRole } from '@hr-system/types'
import { cn } from '@/lib/utils'
import {
  Building2,
  Users,
  Plus,
  X,
  Tag,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  Search,
  UserPlus,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

// ─── Head / Manager appointment slot ───────────────────────────────────────────

function RoleAppointment({
  dept,
  role,
  label,
  canManage,
}: {
  dept: Department
  role: 'DEPT_HEAD' | 'DEPT_MANAGER'
  label: string
  canManage: boolean
}) {
  const [appointing, setAppointing] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const appoint = useAppointDeptRole()
  const dismiss = useDismissDeptRole()
  // Load this department's members only while the picker is open — appointment
  // is restricted to people who belong to this department (backend enforces too).
  const { data: members = [], isLoading } = useDepartmentMembers(appointing ? dept.id : '')

  const Icon = role === 'DEPT_HEAD' ? ShieldCheck : UserCog
  const holders = (dept.employees ?? []).filter((e) => e.user?.role === role)

  // Only plain employees are eligible to be promoted (exclude current head/managers + admins).
  const q = search.trim().toLowerCase()
  const eligible = members
    .filter((m) => (m.user?.role ?? 'EMPLOYEE') === 'EMPLOYEE')
    .filter((m) => !q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))

  function readErr(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  }

  async function handleAppoint(employeeId: string) {
    setError('')
    try {
      await appoint.mutateAsync({ id: dept.id, employeeId, role })
      setAppointing(false)
      setSearch('')
    } catch (err) {
      setError(readErr(err, `Failed to appoint ${label.toLowerCase()}`))
    }
  }

  async function handleDismiss(employeeId: string) {
    setError('')
    try {
      await dismiss.mutateAsync({ id: dept.id, employeeId })
      setConfirmRemoveId(null)
    } catch (err) {
      setError(readErr(err, `Failed to remove ${label.toLowerCase()}`))
    }
  }

  const chip =
    role === 'DEPT_HEAD'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
      : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'

  return (
    <div>
      {!appointing ? (
        <div className="flex items-center gap-2">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', chip)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {holders.length > 0 ? (
              holders.map((h) =>
                confirmRemoveId === h.id ? (
                  <span
                    key={h.id}
                    className="flex items-center gap-1.5 rounded-full bg-destructive/10 py-0.5 pl-2.5 pr-1.5 text-[11px]"
                  >
                    <span className="text-destructive">Remove {h.firstName}?</span>
                    <button
                      onClick={() => handleDismiss(h.id)}
                      disabled={dismiss.isPending}
                      className="font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      {dismiss.isPending ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <span
                    key={h.id}
                    className="group/chip flex items-center gap-1.5 rounded-full bg-muted/60 py-0.5 pl-0.5 pr-1"
                  >
                    <Avatar firstName={h.firstName} lastName={h.lastName} url={h.avatarUrl} size={20} />
                    <span className="truncate text-xs font-medium">
                      {h.firstName} {h.lastName}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => { setConfirmRemoveId(h.id); setError('') }}
                        className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/chip:opacity-100"
                        title={`Remove ${label.toLowerCase()}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )
              )
            ) : canManage ? (
              <button
                onClick={() => { setAppointing(true); setSearch(''); setError('') }}
                className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <UserPlus className="h-3 w-3" /> Assign {label.toLowerCase()}
              </button>
            ) : (
              <span className="text-xs italic text-muted-foreground">Not assigned</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', chip)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Assign ${label.toLowerCase()} — search members…`}
                className="h-7 w-full rounded border bg-background pl-6 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => { setAppointing(false); setSearch(''); setError('') }}
              className="rounded p-1 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="rounded-md border bg-background shadow-sm">
            {isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
            ) : eligible.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {members.length === 0 ? 'No members in this department' : 'No eligible members to promote'}
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto py-1">
                {eligible.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => handleAppoint(m.id)}
                      disabled={appoint.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <Avatar firstName={m.firstName} lastName={m.lastName} url={m.avatarUrl} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-xs font-medium">
                            {m.firstName} {m.lastName}
                          </span>
                          {m.jobTitle && (
                            <>
                              <span className="shrink-0 text-muted-foreground/50">·</span>
                              <span className="truncate text-[10px] text-muted-foreground">{m.jobTitle.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-[10px] text-destructive">{error}</p>}
    </div>
  )
}

// ─── Department detail side-panel (Members / Designations tabs) ─────────────────

function TabBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
        {count}
      </span>
    </button>
  )
}

const MEMBER_ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  DEPT_HEAD: { label: 'Head', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  DEPT_MANAGER: { label: 'Manager', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
}

function DeptDetailPanel({
  dept,
  tab,
  onTabChange,
  canManage,
}: {
  dept: Department
  tab: 'members' | 'designations'
  onTabChange: (t: 'members' | 'designations') => void
  canManage: boolean
}) {
  const { data: members = [], isLoading: loadingMembers } = useDepartmentMembers(dept.id)
  const createTitle = useCreateJobTitle()
  const updateTitle = useUpdateJobTitle()
  const deleteTitle = useDeleteJobTitle()

  const [addingTitle, setAddingTitle]               = useState(false)
  const [newTitleName, setNewTitleName]             = useState('')
  const [titleError, setTitleError]                 = useState('')
  const [editingTitleId, setEditingTitleId]         = useState<string | null>(null)
  const [editingTitleVal, setEditingTitleVal]       = useState('')
  const [editTitleError, setEditTitleError]         = useState('')
  const [confirmDeleteTitleId, setConfirmDeleteTitleId] = useState<string | null>(null)

  function isDuplicateTitle(name: string, excludeId?: string) {
    const lower = name.trim().toLowerCase()
    return dept.jobTitles.some(t => t.name.toLowerCase() === lower && t.id !== excludeId)
  }

  async function saveTitle() {
    const trimmed = newTitleName.trim()
    if (!trimmed) return
    if (isDuplicateTitle(trimmed)) {
      setTitleError(`"${trimmed}" already exists in this department`)
      return
    }
    setTitleError('')
    try {
      await createTitle.mutateAsync({ name: trimmed, departmentId: dept.id })
      setNewTitleName('')
      setAddingTitle(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setTitleError(msg ?? 'Failed to add designation')
    }
  }

  async function saveEditTitle(id: string) {
    const trimmed = editingTitleVal.trim()
    if (!trimmed) return
    if (isDuplicateTitle(trimmed, id)) {
      setEditTitleError(`"${trimmed}" already exists in this department`)
      return
    }
    setEditTitleError('')
    try {
      await updateTitle.mutateAsync({ id, name: trimmed })
      setEditingTitleId(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setEditTitleError(msg ?? 'Failed to update designation')
    }
  }

  async function doDeleteTitle(id: string) {
    await deleteTitle.mutateAsync(id)
    setConfirmDeleteTitleId(null)
  }

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 flex gap-1 border-b bg-card px-3">
        <TabBtn label="Members" count={dept._count.employees} active={tab === 'members'} onClick={() => onTabChange('members')} />
        <TabBtn label="Designations" count={dept.jobTitles.length} active={tab === 'designations'} onClick={() => onTabChange('designations')} />
      </div>

      {tab === 'members' ? (
        <div className="p-3">
          {loadingMembers ? (
            <div className="py-8"><Spinner /></div>
          ) : members.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <>
              <ul className="space-y-0.5">
                {members.map(m => {
                  const badge = m.user?.role ? MEMBER_ROLE_BADGE[m.user.role] : null
                  return (
                    <li key={m.id} className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/50">
                      <Avatar firstName={m.firstName} lastName={m.lastName} url={m.avatarUrl} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.firstName} {m.lastName}</p>
                        {m.jobTitle && <p className="truncate text-xs text-muted-foreground">{m.jobTitle.name}</p>}
                      </div>
                      {badge && (
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', badge.cls)}>
                          {badge.label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              <Link
                href={`/employees?department=${dept.id}`}
                className="mt-2 flex items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium text-primary hover:bg-muted"
              >
                View in Employees →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {dept.jobTitles.length === 0 && !addingTitle && (
            <p className="text-sm text-muted-foreground">No designations yet.</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {dept.jobTitles.map(t => {
              if (editingTitleId === t.id) {
                const hasEditConflict = editingTitleVal.trim().length > 0 && isDuplicateTitle(editingTitleVal, t.id)
                return (
                  <div key={t.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingTitleVal}
                        onChange={e => { setEditingTitleVal(e.target.value); setEditTitleError('') }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditTitle(t.id)
                          if (e.key === 'Escape') { setEditingTitleId(null); setEditTitleError('') }
                        }}
                        className={cn(
                          'w-40 rounded border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-2',
                          (hasEditConflict || editTitleError) ? 'border-destructive focus:ring-destructive' : 'focus:ring-primary'
                        )}
                      />
                      <button
                        onClick={() => saveEditTitle(t.id)}
                        disabled={updateTitle.isPending || hasEditConflict}
                        className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40"
                      >
                        {updateTitle.isPending ? (
                          <span className="block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => { setEditingTitleId(null); setEditTitleError('') }}
                        className="rounded p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {(hasEditConflict || editTitleError) && (
                      <p className="text-[10px] text-destructive">
                        {editTitleError || `"${editingTitleVal.trim()}" already exists`}
                      </p>
                    )}
                  </div>
                )
              }

              if (confirmDeleteTitleId === t.id) {
                return (
                  <div key={t.id} className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-xs">
                    <span className="text-destructive/80">Delete "{t.name}"?</span>
                    <button onClick={() => doDeleteTitle(t.id)} disabled={deleteTitle.isPending}
                      className="font-medium text-destructive hover:underline">
                      {deleteTitle.isPending ? '…' : 'Yes'}
                    </button>
                    <button onClick={() => setConfirmDeleteTitleId(null)}
                      className="text-muted-foreground hover:text-foreground">No</button>
                  </div>
                )
              }

              return (
                <div key={t.id} className="group flex items-center gap-0.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
                  <span>{t.name}</span>
                  {canManage && (
                    <>
                      <button
                        onClick={() => { setEditingTitleId(t.id); setEditingTitleVal(t.name) }}
                        className="ml-1 hidden rounded p-0.5 text-muted-foreground hover:text-foreground group-hover:inline-flex"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteTitleId(t.id)}
                        className="hidden rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:inline-flex"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {canManage && (
            addingTitle ? (
              <div className="pt-1 space-y-1.5">
                <form onSubmit={e => { e.preventDefault(); saveTitle() }} className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newTitleName}
                    onChange={e => { setNewTitleName(e.target.value); if (titleError) setTitleError('') }}
                    placeholder="New designation name…"
                    className={cn(
                      'flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2',
                      titleError ? 'border-destructive focus:ring-destructive' : 'focus:ring-primary'
                    )}
                  />
                  <button
                    type="submit"
                    disabled={!newTitleName.trim() || createTitle.isPending}
                    className="flex min-w-[52px] items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createTitle.isPending ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      'Add'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingTitle(false); setNewTitleName(''); setTitleError('') }}
                    disabled={createTitle.isPending}
                    className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
                {titleError && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {titleError}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAddingTitle(true)}
                className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add designation
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Department Card ──────────────────────────────────────────────────────────

function DeptCard({ dept, canManage, existingCodes }: { dept: Department; canManage: boolean; existingCodes: string[] }) {
  // Which tab the detail side-panel opens to (null = closed).
  const [panelTab, setPanelTab] = useState<'members' | 'designations' | null>(null)

  const [editingName, setEditingName]           = useState(false)
  const [nameVal, setNameVal]                   = useState(dept.name)
  const [editingCode, setEditingCode]           = useState(false)
  const [codeVal, setCodeVal]                   = useState(dept.code)
  const [confirmDeleteDept, setConfirmDeleteDept] = useState(false)
  const [deptError, setDeptError]               = useState('')

  const trimmedCode = codeVal.trim().toUpperCase()
  const codeConflict =
    editingCode &&
    trimmedCode !== dept.code &&
    trimmedCode.length > 0 &&
    existingCodes.includes(trimmedCode)

  const updateDept    = useUpdateDepartment()
  const deleteDept    = useDeleteDepartment()

  async function saveDeptName() {
    const trimmed = nameVal.trim()
    if (!trimmed || trimmed === dept.name) { setEditingName(false); return }
    setDeptError('')
    try {
      await updateDept.mutateAsync({ id: dept.id, name: trimmed })
      setEditingName(false)
    } catch {
      setDeptError('Failed to update name')
    }
  }

  async function saveDeptCode() {
    const trimmed = codeVal.trim().toUpperCase()
    if (!trimmed || trimmed === dept.code) { setEditingCode(false); setCodeVal(dept.code); return }
    if (codeConflict) return
    setDeptError('')
    try {
      await updateDept.mutateAsync({ id: dept.id, code: trimmed })
      setEditingCode(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setDeptError(msg ?? 'Failed to update code')
      setCodeVal(dept.code)
      setEditingCode(false)
    }
  }

  async function confirmDeleteDeptFn() {
    setDeptError('')
    try {
      await deleteDept.mutateAsync(dept.id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setDeptError(msg ?? 'Cannot delete department')
      setConfirmDeleteDept(false)
    }
  }

  return (
    <Card className="group flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveDeptName()
                    if (e.key === 'Escape') { setEditingName(false); setNameVal(dept.name) }
                  }}
                  className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={saveDeptName} disabled={updateDept.isPending}
                  className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setEditingName(false); setNameVal(dept.name) }}
                  className="shrink-0 rounded p-1 hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <h3 className="font-semibold leading-tight truncate">{dept.name}</h3>
            )}
            {editingCode ? (
              <div className="mt-0.5 space-y-0.5">
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={codeVal}
                    onChange={e => setCodeVal(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveDeptCode()
                      if (e.key === 'Escape') { setEditingCode(false); setCodeVal(dept.code) }
                    }}
                    className={cn(
                      'w-24 rounded border bg-background px-1.5 py-0.5 font-mono text-xs focus:outline-none focus:ring-2',
                      codeConflict
                        ? 'border-destructive text-destructive focus:ring-destructive'
                        : 'focus:ring-primary'
                    )}
                  />
                  <button
                    onClick={saveDeptCode}
                    disabled={updateDept.isPending || codeConflict || !trimmedCode}
                    className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => { setEditingCode(false); setCodeVal(dept.code) }}
                    className="rounded p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {codeConflict && (
                  <p className="text-[10px] text-destructive">
                    Code "{trimmedCode}" is already in use
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-0.5 flex items-center gap-1">
                <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {dept.code}
                </span>
                <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {dept.office.code}
                </span>
                {canManage && (
                  <button
                    onClick={() => { setEditingCode(true); setCodeVal(dept.code) }}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    title="Edit code"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {canManage && !editingName && !confirmDeleteDept && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditingName(true); setNameVal(dept.name) }}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDeleteDept(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteDept && (
        <div className="border-t bg-destructive/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">Delete "{dept.name}"?</p>
              {dept._count.employees > 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  <span className="font-semibold">{dept._count.employees} active {dept._count.employees === 1 ? 'employee' : 'employees'}</span> must be transferred to another department before this can be deleted.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  This department has no active employees and can be safely deleted.
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={confirmDeleteDeptFn}
              disabled={deleteDept.isPending || dept._count.employees > 0}
              title={dept._count.employees > 0 ? `Move ${dept._count.employees} active ${dept._count.employees === 1 ? 'employee' : 'employees'} first` : undefined}
              className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteDept.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => { setConfirmDeleteDept(false); setDeptError('') }}
              className="rounded border px-3 py-1 text-xs hover:bg-muted"
            >
              Cancel
            </button>
          </div>
          {deptError && (
            <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{deptError}</p>
            </div>
          )}
        </div>
      )}
      {deptError && !confirmDeleteDept && (
        <div className="flex items-start gap-1.5 border-t px-4 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{deptError}</p>
        </div>
      )}

      {/* Stats row — click a tile to open the detail side-panel */}
      <div className="grid grid-cols-2 gap-px border-t bg-border">
        <button
          onClick={() => setPanelTab('members')}
          className="flex items-center gap-1.5 bg-card px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
          title="View members"
        >
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{dept._count.employees}</span>
          <span className="text-xs text-muted-foreground">{dept._count.employees === 1 ? 'member' : 'members'}</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
        </button>
        <button
          onClick={() => setPanelTab('designations')}
          className="flex items-center gap-1.5 bg-card px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
          title="View designations"
        >
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{dept.jobTitles.length}</span>
          <span className="text-xs text-muted-foreground">{dept.jobTitles.length === 1 ? 'role' : 'roles'}</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
        </button>
      </div>

      {/* Head + Manager appointments */}
      <div className="border-t px-4 py-2.5 space-y-2.5">
        <RoleAppointment dept={dept} role="DEPT_HEAD" label="Head" canManage={canManage} />
        <RoleAppointment dept={dept} role="DEPT_MANAGER" label="Manager" canManage={canManage} />
      </div>

      {/* Detail side-panel — Members / Designations */}
      <SidePanel
        open={panelTab !== null}
        onClose={() => setPanelTab(null)}
        title={dept.name}
        subtitle={`${dept.code} · ${dept.office.code}`}
      >
        <DeptDetailPanel
          dept={dept}
          tab={panelTab ?? 'members'}
          onTabChange={(t) => setPanelTab(t)}
          canManage={canManage}
        />
      </SidePanel>
    </Card>
  )
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function DeptCardSkeleton() {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-px border-t bg-border">
        <div className="bg-card px-4 py-2.5"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></div>
        <div className="bg-card px-4 py-2.5"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></div>
      </div>
      {/* Head + Manager rows */}
      <div className="space-y-2.5 border-t px-4 py-3">
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  )
}

// ─── Create Department Form ───────────────────────────────────────────────────

function CreateDeptForm({ defaultOfficeId, onDone }: { defaultOfficeId: string; onDone: () => void }) {
  const create = useCreateDepartment()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setError('')
    try {
      await create.mutateAsync({ name: name.trim(), code: code.trim().toUpperCase(), officeId: defaultOfficeId })
      onDone()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create')
    }
  }

  return (
    <Card className="border-primary/40">
      <p className="mb-4 text-sm font-semibold">New Department</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Marketing"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. MKT"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || !code.trim() || create.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create Department'}
          </button>
          <button type="button" onClick={onDone} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments()
  const { user } = useAuthStore()
  const canManage = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)

  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch]         = useState('')

  const filtered = (departments ?? []).filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
  )

  const totalEmployees   = (departments ?? []).reduce((s, d) => s + d._count.employees, 0)
  const totalDesignations = (departments ?? []).reduce((s, d) => s + d.jobTitles.length, 0)
  const defaultOfficeId  = departments?.[0]?.officeId ?? ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Departments</h1>
          <p className="text-sm text-muted-foreground">Organisational structure and designations</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Department
          </button>
        )}
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-1.5">
                <div className="h-5 w-10 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : departments && departments.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: LayoutGrid, label: 'Departments', value: departments.length },
            { icon: Users,       label: 'Total Employees', value: totalEmployees },
            { icon: Tag,         label: 'Total Designations', value: totalDesignations },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className={cn('flex items-center gap-3 rounded-xl border bg-card px-4 py-3')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Search + create form */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search departments…"
            className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {showCreate && canManage && defaultOfficeId && (
        <CreateDeptForm defaultOfficeId={defaultOfficeId} onDone={() => setShowCreate(false)} />
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <DeptCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          {search ? `No departments match "${search}"` : 'No departments yet.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(dept => (
            <DeptCard
              key={dept.id}
              dept={dept}
              canManage={canManage}
              existingCodes={(departments ?? []).map(d => d.code).filter(c => c !== dept.code)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
