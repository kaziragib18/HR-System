'use client'

import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard'
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const isManager =
    user &&
    [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD].includes(
      user.role as UserRole
    )

  return isManager ? <ManagerDashboard /> : <EmployeeDashboard />
}
