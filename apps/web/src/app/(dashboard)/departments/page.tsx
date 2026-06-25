'use client'

import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { UserRole } from '@hr-system/types'
import { Building2, Users } from 'lucide-react'

export default function DepartmentsPage() {
  const { data, isLoading } = useDepartments()
  const { user } = useAuthStore()
  const canManage =
    user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)

  return (
    <div>
      <PageHeader title="Departments" description="Organisational structure across offices" />

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState message="No departments yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((dept) => (
            <Card key={dept.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium">{dept.name}</h3>
                    <p className="text-xs text-muted-foreground">{dept.code}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {dept.office.code}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {dept._count.employees} members
                </span>
                {dept.manager && (
                  <span className="text-xs text-muted-foreground">
                    Mgr: {dept.manager.firstName} {dept.manager.lastName}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <p className="mt-4 text-xs text-muted-foreground">
          Department creation &amp; manager assignment UI is available via the API; an editor lands in
          a later iteration.
        </p>
      )}
    </div>
  )
}
