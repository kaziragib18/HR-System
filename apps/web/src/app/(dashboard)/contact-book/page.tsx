'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useContactBook } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { PageHeader, Card, Avatar, Spinner, EmptyState } from '@/components/ui/primitives'
import { BloodGroup } from '@hr-system/types'
import { Search, X, Droplet, Mail, Phone } from 'lucide-react'

export default function ContactBookPage() {
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

          <select
            value={departmentId}
            onChange={e => { setDepartmentId(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={bloodGroup}
            onChange={e => { setBloodGroup(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All blood groups</option>
            {bloodGroupOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {(search || departmentId || bloodGroup) && (
            <button
              onClick={() => { setSearch(''); setDepartmentId(''); setBloodGroup(''); setPage(1) }}
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
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Designation</th>
                  <th className="px-4 py-2 font-medium">Contact Info</th>
                  <th className="px-4 py-2 font-medium">Blood Group</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
                        <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} />
                        <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{emp.employeeId}</td>
                    <td className="px-4 py-2">{emp.department?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{emp.jobTitle?.name ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-muted-foreground" /> {emp.email}
                        </p>
                        {emp.phone && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {emp.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {emp.bloodGroup ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                          <Droplet className="h-3 w-3" /> {emp.bloodGroup}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
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
