'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useAssignDeptManager,
  useRemoveDeptManager,
  useEmployeeSearch,
  useDepartmentMembers,
  type Department,
} from '@/lib/api/hooks/useDepartments'
import {
  useCreateJobTitle,
  useUpdateJobTitle,
  useDeleteJobTitle,
} from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { Card, Spinner } from '@/components/ui/primitives'
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
  ChevronDown,
  ChevronRight,
  UserCircle,
  LayoutGrid,
  Search,
  UserPlus,
  UserMinus,
} from 'lucide-react'

// ─── Department Card ──────────────────────────────────────────────────────────

function DeptCard({ dept, canManage, existingCodes }: { dept: Department; canManage: boolean; existingCodes: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(false)
  const { data: members = [], isLoading: loadingMembers } = useDepartmentMembers(membersExpanded ? dept.id : '')

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

  const [addingTitle, setAddingTitle]               = useState(false)
  const [newTitleName, setNewTitleName]             = useState('')
  const [titleError, setTitleError]                 = useState('')
  const [editingTitleId, setEditingTitleId]         = useState<string | null>(null)
  const [editingTitleVal, setEditingTitleVal]       = useState('')
  const [editTitleError, setEditTitleError]         = useState('')
  const [confirmDeleteTitleId, setConfirmDeleteTitleId] = useState<string | null>(null)

  const [managingManager, setManagingManager]   = useState(false)
  const [managerSearch, setManagerSearch]       = useState('')
  const [confirmRemoveMgr, setConfirmRemoveMgr] = useState(false)

  const updateDept    = useUpdateDepartment()
  const deleteDept    = useDeleteDepartment()
  const assignMgr     = useAssignDeptManager()
  const removeMgr     = useRemoveDeptManager()
  const createTitle   = useCreateJobTitle()
  const updateTitle   = useUpdateJobTitle()
  const deleteTitle   = useDeleteJobTitle()
  const { data: empResults = [], isFetching: searchingEmps } = useEmployeeSearch(managerSearch)

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

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-px border-t bg-border">
        <div className="flex items-center gap-1.5 bg-card px-4 py-2.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{dept._count.employees}</span>
          <span className="text-xs text-muted-foreground">{dept._count.employees === 1 ? 'member' : 'members'}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-card px-4 py-2.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{dept.jobTitles.length}</span>
          <span className="text-xs text-muted-foreground">{dept.jobTitles.length === 1 ? 'role' : 'roles'}</span>
        </div>
      </div>

      {/* Manager section */}
      <div className="border-t px-4 py-2.5">
        {!managingManager ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {dept.manager ? (
                <>
                  <span className="text-xs text-muted-foreground">Head:</span>
                  <span className="text-xs font-medium truncate">
                    {dept.manager.firstName} {dept.manager.lastName}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic">No manager assigned</span>
              )}
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => { setManagingManager(true); setManagerSearch('') }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={dept.manager ? 'Change manager' : 'Add manager'}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
                {dept.manager && !confirmRemoveMgr && (
                  <button
                    onClick={() => setConfirmRemoveMgr(true)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remove manager"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
                {confirmRemoveMgr && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-destructive">Remove?</span>
                    <button
                      onClick={async () => { await removeMgr.mutateAsync(dept.id); setConfirmRemoveMgr(false) }}
                      disabled={removeMgr.isPending}
                      className="text-[10px] font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      {removeMgr.isPending ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveMgr(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Manager search panel */
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={managerSearch}
                  onChange={e => setManagerSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="h-7 w-full rounded border bg-background pl-6 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => { setManagingManager(false); setManagerSearch('') }}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Results */}
            {managerSearch.trim().length > 0 && (
              <div className="rounded-md border bg-background shadow-sm">
                {searchingEmps ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                ) : empResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No employees found</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {empResults.map(emp => (
                      <li key={emp.id}>
                        <button
                          onClick={async () => {
                            await assignMgr.mutateAsync({ id: dept.id, managerId: emp.id })
                            setManagingManager(false)
                            setManagerSearch('')
                          }}
                          disabled={assignMgr.isPending}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-medium truncate shrink-0">
                                {emp.firstName} {emp.lastName}
                              </span>
                              {emp.jobTitle && (
                                <>
                                  <span className="text-muted-foreground/50 shrink-0">·</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{emp.jobTitle.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {dept.manager?.id === emp.id && (
                            <Check className="ml-auto h-3 w-3 shrink-0 text-primary" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members (collapsible) */}
      {dept._count.employees > 0 && (
        <div className="border-t">
          <button
            onClick={() => setMembersExpanded(e => !e)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <span className="font-medium">Members</span>
            {membersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {membersExpanded && (
            <div className="px-2 pb-3">
              {loadingMembers ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>
              ) : members.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {members.map(m => (
                    <li key={m.id}>
                      <Link
                        href={`/employees?department=${dept.id}`}
                        title={`View all members of ${dept.name}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-medium truncate shrink-0">
                              {m.firstName} {m.lastName}
                            </span>
                            {m.jobTitle && (
                              <>
                                <span className="text-muted-foreground/50 shrink-0">·</span>
                                <span className="text-[10px] text-muted-foreground truncate">{m.jobTitle.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Designations (collapsible) */}
      {(dept.jobTitles.length > 0 || canManage) && (
        <div className="border-t">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <span className="font-medium">Designations</span>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {dept.jobTitles.length === 0 && !addingTitle && (
                <p className="text-xs text-muted-foreground">No designations yet.</p>
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
                    <form
                      onSubmit={e => { e.preventDefault(); saveTitle() }}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        value={newTitleName}
                        onChange={e => {
                          setNewTitleName(e.target.value)
                          if (titleError) setTitleError('')
                        }}
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
      )}
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
      {!isLoading && departments && departments.length > 0 && (
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
      )}

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
        <Spinner />
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
