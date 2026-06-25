'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useEmployees } from '@/lib/api/hooks/useEmployees'
import { PageHeader, Card, Avatar, StatusBadge, Spinner, EmptyState } from '@/components/ui/primitives'
import { Plus, Search } from 'lucide-react'

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useEmployees({ search, page, limit: 20 })

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
        <div className="border-b p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search by name, email, or ID…"
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data?.data.length ? (
          <EmptyState message="No employees found." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Office</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((emp) => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} />
                      <div>
                        <p className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{emp.employeeId}</td>
                  <td className="px-4 py-2">{emp.department?.name}</td>
                  <td className="px-4 py-2">{emp.office?.code}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={emp.employmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
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
