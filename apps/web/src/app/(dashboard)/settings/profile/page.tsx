'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useEmployee } from '@/lib/api/hooks/useEmployees'
import { Card, Spinner } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/tabs'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { EmployeeOverviewTab } from '@/components/employees/EmployeeOverviewTab'
import { WorkExperienceSection } from '@/components/profile/WorkExperienceSection'
import { EducationSection } from '@/components/profile/EducationSection'
import { SkillsSection } from '@/components/profile/SkillsSection'
import { IdentificationSection } from '@/components/profile/IdentificationSection'
import { TrainingSection } from '@/components/profile/TrainingSection'
import { UserRole } from '@hr-system/types'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'work-experience', label: 'Work Experience' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
  { key: 'identification', label: 'Identification' },
  { key: 'training', label: 'Training' },
]

export default function ProfileSettingsPage() {
  const { user } = useAuthStore()
  const employeeId = user?.employeeId ?? ''
  const isHrAdmin = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const { data: emp, isLoading } = useEmployee(employeeId)
  const [tab, setTab] = useState('overview')

  if (!user) return null
  if (isLoading) return <Spinner />
  if (!emp) return <p className="text-sm text-muted-foreground">Profile not found.</p>

  return (
    <div>
      <Card className="mb-4 max-w-2xl">
        <div className="flex items-center gap-4">
          <AvatarUploader employeeId={employeeId} firstName={emp.firstName} lastName={emp.lastName} avatarUrl={emp.avatarUrl} canEdit size={64} />
          <div>
            <h2 className="text-lg font-semibold">
              {emp.firstName} {emp.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">{emp.email}</p>
          </div>
        </div>
      </Card>

      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <EmployeeOverviewTab employee={emp} canEditPersonal canEditEmployment={false} canEditIdentity={isHrAdmin} />
      )}
      {tab === 'work-experience' && <WorkExperienceSection employeeId={employeeId} canEdit />}
      {tab === 'education' && <EducationSection employeeId={employeeId} canEdit />}
      {tab === 'skills' && <SkillsSection employeeId={employeeId} canEdit />}
      {tab === 'identification' && <IdentificationSection employeeId={employeeId} canEdit />}
      {tab === 'training' && <TrainingSection employeeId={employeeId} canEdit />}
    </div>
  )
}
