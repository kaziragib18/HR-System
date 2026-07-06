'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useEmployee } from '@/lib/api/hooks/useEmployees'
import { useAuthStore } from '@/store/auth.store'
import { Card, StatusBadge, Spinner, PageHeader } from '@/components/ui/primitives'
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

export default function EmployeeProfilePage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuthStore()

  const isHrAdmin = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const isSelf = !!user && user.employeeId === id
  const canEdit = isHrAdmin || isSelf

  const { data: emp, isLoading } = useEmployee(id)
  const [tab, setTab] = useState('overview')

  if (isLoading) return <Spinner />
  if (!emp) return <p className="text-sm text-muted-foreground">Employee not found.</p>

  return (
    <div>
      <PageHeader title="Employee profile" />

      {/* Header */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <AvatarUploader employeeId={emp.id} firstName={emp.firstName} lastName={emp.lastName} avatarUrl={emp.avatarUrl} canEdit={canEdit} size={64} />
          <div>
            <h2 className="text-xl font-semibold">
              {emp.firstName} {emp.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {emp.jobTitle?.name ?? 'No title'} · {emp.department?.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{emp.employeeId}</span>
              <StatusBadge status={emp.employmentStatus} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <EmployeeOverviewTab employee={emp} canEditPersonal={canEdit} canEditEmployment={isHrAdmin} canEditIdentity={isHrAdmin} />
      )}
      {tab === 'work-experience' && <WorkExperienceSection employeeId={id} canEdit={canEdit} />}
      {tab === 'education' && <EducationSection employeeId={id} canEdit={canEdit} />}
      {tab === 'skills' && <SkillsSection employeeId={id} canEdit={canEdit} />}
      {tab === 'identification' && <IdentificationSection employeeId={id} canEdit={canEdit} />}
      {tab === 'training' && <TrainingSection employeeId={id} canEdit={canEdit} />}
    </div>
  )
}
