'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useEmployee } from '@/lib/api/hooks/useEmployees'
import { useAuthStore } from '@/store/auth.store'
import { Card, StatusBadge, Skeleton, PageHeader } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/tabs'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { EmployeeOverviewTab } from '@/components/employees/EmployeeOverviewTab'
import { WorkExperienceSection } from '@/components/profile/WorkExperienceSection'
import { EducationSection } from '@/components/profile/EducationSection'
import { SkillsSection } from '@/components/profile/SkillsSection'
import { IdentificationSection } from '@/components/profile/IdentificationSection'
import { TrainingSection } from '@/components/profile/TrainingSection'
import { PasswordResetButton } from '@/components/employees/PasswordResetButton'
import { UserRole } from '@hr-system/types'
import { formatDate } from '@hr-system/utils'
import { cn } from '@/lib/utils'
import { UserX, Mail, Phone, CalendarDays } from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'work-experience', label: 'Work Experience' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
  { key: 'identification', label: 'Identification' },
  { key: 'training', label: 'Training' },
]

const OFFICE_BADGE: Record<string, string> = {
  BD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  UK: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
}

function ProfileSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="mb-6 flex gap-4 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-4 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-3 w-full" />)}
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function EmployeeProfilePage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuthStore()

  const isHrAdmin = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const isSelf = !!user && user.employeeId === id
  const canEdit = isHrAdmin || isSelf

  const { data: emp, isLoading } = useEmployee(id)
  const [tab, setTab] = useState('overview')

  if (isLoading) return <ProfileSkeleton />
  if (!emp) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserX className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Employee not found</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          This profile doesn&apos;t exist, or you don&apos;t have access to view it.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Employee profile" />

      {/* Header */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarUploader employeeId={emp.id} firstName={emp.firstName} lastName={emp.lastName} avatarUrl={emp.avatarUrl} canEdit={canEdit} size={64} />
            <div>
              <h2 className="text-xl font-semibold">
                {emp.firstName} {emp.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {emp.jobTitle?.name ?? 'No title'} · {emp.department?.name}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{emp.employeeId}</span>
                <StatusBadge status={emp.employmentStatus} />
                {emp.office?.code && (
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold', OFFICE_BADGE[emp.office.code] ?? 'bg-muted text-muted-foreground')}>
                    {emp.office.code}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</span>
                {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>}
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Joined {formatDate(emp.joiningDate)}</span>
              </div>
            </div>
          </div>
        </div>
        {isHrAdmin && <PasswordResetButton employeeId={emp.id} />}
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
