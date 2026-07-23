'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useContactBook } from '@/lib/api/hooks/useEmployees'
import { useDepartments, departmentLabel } from '@/lib/api/hooks/useDepartments'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, Card, Avatar, ListSkeleton } from '@/components/ui/primitives'
import { BloodGroup, UserRole } from '@hr-system/types'
import type { ContactBookEntry } from '@hr-system/types'
import { cn } from '@/lib/utils'
import { Search, X, Droplet, Mail, Phone, BookUser } from 'lucide-react'

const MANAGER_TIER = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER]

function BloodChip({ group }: { group?: BloodGroup | null }) {
  if (!group) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
      <Droplet className="h-3 w-3" /> {group}
    </span>
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

export default function ContactBookPage() {
  const { user } = useAuthStore()
  // Contact Book is visible to everyone, but only a manager-tier viewer can
  // drill into the full employee profile — a plain employee sees the same
  // row info and nothing more, so their card isn't a link at all.
  const canViewProfile = !!user && MANAGER_TIER.includes(user.role as UserRole)
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useContactBook({
    search,
    page,
    limit: 20,
    departmentId: departmentId || undefined,
    bloodGroup: bloodGroup || undefined,
  })
  const { data: departments = [] } = useDepartments()

  const bloodGroupOptions = Object.values(BloodGroup).map(v => ({ value: v, label: v }))
  const rows = data?.data ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1
  const hasFilters = !!(search || departmentId || bloodGroup)
  const selectCls = 'h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  function clearFilters() { setSearch(''); setDepartmentId(''); setBloodGroup(''); setPage(1) }

  return (
    <div>
      <PageHeader
        title="Contact Book"
        description="Everyone's contact info and blood group, in one place"
      />

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
          <select value={departmentId} onChange={e => { setDepartmentId(e.target.value); setPage(1) }} className={selectCls}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{departmentLabel(d, departments)}</option>)}
          </select>
          <select value={bloodGroup} onChange={e => { setBloodGroup(e.target.value); setPage(1) }} className={selectCls}>
            <option value="">All blood groups</option>
            {bloodGroupOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex h-9 items-center gap-1 rounded-md border px-2.5 text-sm text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* ── Loading / empty / content ── */}
        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookUser className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No contacts found</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {hasFilters ? 'No one matches the current filters.' : 'There are no contacts to show yet.'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Clear filters</button>
            )}
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
                    <th className="px-4 py-2.5 font-medium">Department</th>
                    <th className="px-4 py-2.5 font-medium">Designation</th>
                    <th className="px-4 py-2.5 font-medium">Contact Info</th>
                    <th className="px-4 py-2.5 font-medium">Blood Group</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp: ContactBookEntry) => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        {canViewProfile ? (
                          <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
                            <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={36} />
                            <p className="truncate font-medium">{emp.firstName} {emp.lastName}</p>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={36} />
                            <p className="truncate font-medium">{emp.firstName} {emp.lastName}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{emp.employeeId}</td>
                      <td className="px-4 py-2.5">{emp.department?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{emp.jobTitle?.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-muted-foreground" /> {emp.email}</p>
                          {emp.phone && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {emp.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><BloodChip group={emp.bloodGroup} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {rows.map((emp: ContactBookEntry) => {
                const content = (
                  <>
                    <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{emp.firstName} {emp.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {emp.jobTitle?.name ?? '—'} · {emp.department?.name ?? '—'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /> {emp.email}
                      </p>
                    </div>
                    <BloodChip group={emp.bloodGroup} />
                  </>
                )
                return canViewProfile ? (
                  <Link key={emp.id} href={`/employees/${emp.id}`} className="flex items-center gap-3 border-b p-3 last:border-0 hover:bg-muted/40">
                    {content}
                  </Link>
                ) : (
                  <div key={emp.id} className="flex items-center gap-3 border-b p-3 last:border-0">
                    {content}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Pagination footer ── */}
        {!isLoading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {total} {total === 1 ? 'contact' : 'contacts'}
              {totalPages > 1 && <> · page {data?.meta.page} of {totalPages}</>}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">Previous</button>
                {pageWindow(page, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn('min-w-8 rounded-md border px-2.5 py-1', p === page ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >
                      {p}
                    </button>
                  )
                )}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-md border px-3 py-1 hover:bg-muted disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
