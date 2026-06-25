'use client'

import { useAuthStore } from '@/store/auth.store'
import { useDashboardStats, useHeadcountByDepartment } from '@/lib/api/hooks/useDashboard'
import { StatCard, Card, Spinner } from '@/components/ui/primitives'
import { UserRole } from '@hr-system/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isManager =
    user &&
    [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD].includes(
      user.role as UserRole
    )

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome back{user ? `, ${user.firstName}` : ''}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {user ? `${user.role.replace(/_/g, ' ')} · ${user.officeCode} office` : ''}
      </p>

      {isManager ? <ManagerDashboard /> : <EmployeeDashboard />}
    </div>
  )
}

function ManagerDashboard() {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: byDept } = useHeadcountByDepartment()

  if (isLoading) return <Spinner />

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Headcount" value={stats?.headcount ?? 0} />
        <StatCard label="On probation" value={stats?.onProbation ?? 0} />
        <StatCard label="On leave today" value={stats?.onLeaveToday ?? 0} />
        <StatCard label="Late today" value={stats?.lateToday ?? 0} />
        <StatCard label="Pending leave requests" value={stats?.pendingLeaves ?? 0} />
        <StatCard label="Open timesheets" value={stats?.openTimesheets ?? 0} />
      </div>

      {byDept && byDept.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-medium">Headcount by department</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDept}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="department" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221.2 83.2% 53.3%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

function EmployeeDashboard() {
  return (
    <div className="mt-6">
      <Card>
        <p className="text-sm text-muted-foreground">
          Use the sidebar to view your attendance, apply for leave, and manage your timesheets.
          Self-service features arrive in Phase 2.
        </p>
      </Card>
    </div>
  )
}
