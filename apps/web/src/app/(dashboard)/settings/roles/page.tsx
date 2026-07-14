'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useEmployees, useUpdateEmployeeRole } from '@/lib/api/hooks/useEmployees'
import { useOffices } from '@/lib/api/hooks/useReference'
import { Card, Avatar, Spinner, EmptyState, RolePill, fmtRole } from '@/components/ui/primitives'
import { UserRole } from '@hr-system/types'
import { ShieldOff, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'

const ALL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.DEPT_HEAD,
  UserRole.TEAM_LEAD,
  UserRole.EMPLOYEE,
]

const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD]
const HR_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER]

const PERMISSION_MATRIX: { capability: string; roles: UserRole[] }[] = [
  { capability: 'Manage own profile, check in/out, apply for leave, view own payslip', roles: ALL_ROLES },
  { capability: 'View department directory & org chart', roles: ALL_ROLES },
  { capability: 'View holiday calendar & job grade list', roles: ALL_ROLES },
  { capability: 'View the full employee directory', roles: MANAGER_ROLES },
  { capability: 'Approve leave, late-excuse & attendance-adjustment requests', roles: MANAGER_ROLES },
  { capability: 'Create/edit employees, departments, job grades, holidays', roles: HR_ROLES },
  { capability: 'Manage salary structures', roles: HR_ROLES },
  { capability: "View any employee's individual salary", roles: HR_ROLES },
  { capability: 'Create & process payroll runs', roles: [UserRole.SUPER_ADMIN] },
  { capability: 'Manage company profile & compliance documents', roles: [UserRole.SUPER_ADMIN] },
  { capability: 'Cross-office access (BD & UK)', roles: [UserRole.SUPER_ADMIN] },
  { capability: 'Assign employee roles', roles: [UserRole.SUPER_ADMIN] },
]

function PermissionMatrix() {
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What each role can do
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 text-left">Capability</th>
              {ALL_ROLES.map(role => (
                <th key={role} className="px-2 py-2 text-center">{fmtRole(role)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.map(row => (
              <tr key={row.capability} className="border-b last:border-0">
                <td className="py-2.5 pr-4 text-xs">{row.capability}</td>
                {ALL_ROLES.map(role => (
                  <td key={role} className="px-2 py-2.5 text-center">
                    {row.roles.includes(role) ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This reflects the app's actual access rules — it isn't independently configurable per person.
      </p>
    </Card>
  )
}

interface RoleChangeTarget {
  id: string
  firstName: string
  lastName: string
  currentRole: string
}

function ChangeRoleModal({ target, onClose }: { target: RoleChangeTarget; onClose: () => void }) {
  const [role, setRole] = useState(target.currentRole)
  const updateRole = useUpdateEmployeeRole()
  const [error, setError] = useState('')

  async function handleConfirm() {
    setError('')
    try {
      await updateRole.mutateAsync({ id: target.id, role })
      onClose()
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(message ?? 'Failed to update role')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">Change Role</p>
            <p className="text-xs text-muted-foreground">{target.firstName} {target.lastName}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">New role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{fmtRole(r)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={updateRole.isPending || role === target.currentRole}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateRole.isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PeopleList() {
  const [search, setSearch] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<RoleChangeTarget | null>(null)

  const { data: offices = [] } = useOffices()
  const { data, isLoading } = useEmployees({ search: search || undefined, officeId: officeId || undefined, page, limit: 20 })

  const items = (data?.data ?? []).filter(e => !roleFilter || e.user?.role === roleFilter)

  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name, email or ID…"
          className="min-w-[220px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={officeId}
          onChange={e => { setOfficeId(e.target.value); setPage(1) }}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Offices</option>
          {offices.map(o => (
            <option key={o.id} value={o.id}>{o.code}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>{fmtRole(r)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState message="No employees match these filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-1 text-left">Employee</th>
                <th className="py-2 text-left">Office</th>
                <th className="py-2 text-left">Department</th>
                <th className="py-2 text-left">Role</th>
                <th className="py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(emp => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2.5 pl-1">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={28} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">{emp.office.code}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">{emp.department?.name ?? '—'}</td>
                  <td className="py-2.5">
                    {emp.user?.role ? <RolePill role={emp.user.role} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => setTarget({ id: emp.id, firstName: emp.firstName, lastName: emp.lastName, currentRole: emp.user?.role ?? UserRole.EMPLOYEE })}
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Change Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page >= data.meta.totalPages}
            className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {target && <ChangeRoleModal target={target} onClose={() => setTarget(null)} />}
    </Card>
  )
}

export default function RolesSettingsPage() {
  const user = useAuthStore(s => s.user)

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">Access restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">Only Super Admins can manage roles and permissions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PermissionMatrix />
      <PeopleList />
    </div>
  )
}
