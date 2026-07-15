'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard'
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard'
import { HolidaysPanel } from '@/components/dashboard/HolidaysPanel'
import { CompanyPanel } from '@/components/dashboard/CompanyPanel'
import { Tabs } from '@/components/ui/tabs'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('overview')

  // DEPT_HEAD/DEPT_MANAGER get the employee-style dashboard (their own attendance,
  // leave, team) — not the office-wide stats view, which stays SUPER_ADMIN/HR_MANAGER
  // only. Their team/department context surfaces inside EmployeeDashboard instead.
  const isManager =
    !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const canSeeHolidays = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const canSeeCompany = user?.role === UserRole.SUPER_ADMIN

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'holidays', label: 'Holidays', hidden: !canSeeHolidays },
    { key: 'company', label: 'Company', hidden: !canSeeCompany },
  ]
  const showTabs = tabs.filter(t => !t.hidden).length > 1

  return (
    <div>
      {showTabs && <Tabs items={tabs} active={tab} onChange={setTab} />}
      {tab === 'overview' && (isManager ? <ManagerDashboard /> : <EmployeeDashboard />)}
      {tab === 'holidays' && canSeeHolidays && <HolidaysPanel />}
      {tab === 'company' && canSeeCompany && <CompanyPanel />}
    </div>
  )
}
