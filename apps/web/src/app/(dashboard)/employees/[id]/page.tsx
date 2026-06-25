'use client'

import { useParams } from 'next/navigation'
import { useEmployee } from '@/lib/api/hooks/useEmployees'
import { Card, Avatar, StatusBadge, Spinner, PageHeader } from '@/components/ui/primitives'
import { formatDate } from '@hr-system/utils'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

export default function EmployeeProfilePage() {
  const params = useParams()
  const id = params.id as string
  const { data: emp, isLoading } = useEmployee(id)

  if (isLoading) return <Spinner />
  if (!emp) return <p className="text-sm text-muted-foreground">Employee not found.</p>

  return (
    <div>
      <PageHeader title="Employee profile" />

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Avatar firstName={emp.firstName} lastName={emp.lastName} url={emp.avatarUrl} size={64} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-medium">Personal</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" value={emp.email} />
            <Field label="Phone" value={emp.phone} />
            <Field label="Date of birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null} />
            <Field label="Gender" value={emp.gender} />
            <Field label="Nationality" value={emp.nationality} />
            <Field label="National ID" value={emp.nationalId} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-medium">Employment</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Office" value={`${emp.office?.name} (${emp.office?.code})`} />
            <Field label="Department" value={emp.department?.name} />
            <Field label="Job grade" value={emp.jobGrade?.name} />
            <Field label="Type" value={emp.employmentType?.replace(/_/g, ' ')} />
            <Field label="Joining date" value={formatDate(emp.joiningDate)} />
            <Field
              label="Probation ends"
              value={emp.probationEndDate ? formatDate(emp.probationEndDate) : null}
            />
            <Field
              label="Reports to"
              value={emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : null}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
