'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateEmployee } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useJobGrades } from '@/lib/api/hooks/useReference'
import { PageHeader, Card } from '@/components/ui/primitives'
import { EmploymentType } from '@hr-system/types'
import { Copy, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  officeId: z.string().min(1, 'Select an office'),
  departmentId: z.string().min(1, 'Select a department'),
  jobGradeId: z.string().optional(),
  employmentType: z.nativeEnum(EmploymentType),
  joiningDate: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

const field = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-sm font-medium'

export default function NewEmployeePage() {
  const router = useRouter()
  const { data: departments } = useDepartments()
  const { data: grades } = useJobGrades()
  const createEmployee = useCreateEmployee()
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employmentType: EmploymentType.FULL_TIME },
  })

  const selectedOffice = watch('officeId')

  const offices = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>()
    departments?.forEach((d) => map.set(d.office.id, d.office))
    return [...map.values()]
  }, [departments])

  const filteredDepartments = departments?.filter((d) => d.officeId === selectedOffice) ?? []
  const filteredGrades = grades?.filter((g) => g.officeId === selectedOffice) ?? []

  const onSubmit = async (values: FormValues) => {
    const result = await createEmployee.mutateAsync({
      ...values,
      joiningDate: new Date(values.joiningDate).toISOString(),
    })
    setTempPassword(result.tempPassword)
  }

  if (tempPassword) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Employee created</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Share this temporary password with the new employee. They should change it after first
            login. It will not be shown again.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
            <span>{tempPassword}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(tempPassword)
                setCopied(true)
              }}
              className="inline-flex items-center gap-1 text-xs text-primary"
            >
              <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => router.push('/employees')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to employees
            </button>
            <button
              onClick={() => {
                setTempPassword(null)
                setCopied(false)
              }}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Add another
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add employee" description="Create a profile and login account" />
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>First name</label>
              <input className={field} {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Last name</label>
              <input className={field} {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Email</label>
              <input type="email" className={field} {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Phone</label>
              <input className={field} {...register('phone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Office</label>
              <select className={field} {...register('officeId')}>
                <option value="">Select office…</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
              {errors.officeId && <p className="text-xs text-destructive">{errors.officeId.message}</p>}
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Department</label>
              <select className={field} {...register('departmentId')} disabled={!selectedOffice}>
                <option value="">Select department…</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.departmentId && (
                <p className="text-xs text-destructive">{errors.departmentId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className={labelCls}>Job grade</label>
              <select className={field} {...register('jobGradeId')} disabled={!selectedOffice}>
                <option value="">None</option>
                {filteredGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Employment type</label>
              <select className={field} {...register('employmentType')}>
                {Object.values(EmploymentType).map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Joining date</label>
              <input type="date" className={field} {...register('joiningDate')} />
              {errors.joiningDate && (
                <p className="text-xs text-destructive">{errors.joiningDate.message}</p>
              )}
            </div>
          </div>

          {createEmployee.isError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(createEmployee.error as { response?: { data?: { error?: string } } })?.response?.data
                ?.error ?? 'Failed to create employee'}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={createEmployee.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createEmployee.isPending ? 'Creating…' : 'Create employee'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
