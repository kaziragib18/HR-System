'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateEmployee } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import {
  useJobGrades,
  useJobTitles,
  useCreateJobTitle,
  useOffices,
} from '@/lib/api/hooks/useReference'
import { SubmitOverlay } from '@/components/ui/primitives'
import { EmploymentType, UserRole } from '@hr-system/types'
import { Copy, Check, CheckCircle2, Plus, X, Loader2 } from 'lucide-react'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  officeId: z.string().min(1, 'Select an office'),
  departmentId: z.string().min(1, 'Select a department'),
  jobTitleId: z.string().optional(),
  jobGradeId: z.string().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
  employmentType: z.nativeEnum(EmploymentType),
  joiningDate: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

const ROLE_OPTIONS = [
  { value: UserRole.EMPLOYEE, label: 'Employee' },
  { value: UserRole.DEPT_MANAGER, label: 'Department Manager' },
  { value: UserRole.DEPT_HEAD, label: 'Department Head' },
  { value: UserRole.HR_MANAGER, label: 'HR Manager' },
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
]

const field =
  'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'mb-1 block text-sm font-medium'

export function NewEmployeeModal({ onClose }: { onClose: () => void }) {
  const { data: departments } = useDepartments()
  const { data: grades } = useJobGrades()
  const { data: offices = [] } = useOffices()
  const createEmployee = useCreateEmployee()
  const createJobTitle = useCreateJobTitle()

  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAddTitle, setShowAddTitle] = useState(false)
  const [newTitleName, setNewTitleName] = useState('')

  const isPending = createEmployee.isPending

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employmentType: EmploymentType.FULL_TIME, role: UserRole.EMPLOYEE },
  })

  const selectedOffice = watch('officeId')
  const selectedDept = watch('departmentId')
  const selectedTitle = watch('jobTitleId')

  const { data: deptTitles = [] } = useJobTitles(selectedDept || undefined)

  const filteredDepts = departments?.filter((d) => d.officeId === selectedOffice) ?? []
  const filteredGrades = grades?.filter((g) => g.officeId === selectedOffice) ?? []

  // Only one active office exists — skip the picker and select it automatically.
  useEffect(() => {
    if (offices.length === 1 && !selectedOffice) {
      setValue('officeId', offices[0].id)
    }
  }, [offices, selectedOffice, setValue])

  async function handleAddTitle() {
    const name = newTitleName.trim()
    if (!name || !selectedDept) return
    const created = await createJobTitle.mutateAsync({ name, departmentId: selectedDept })
    setValue('jobTitleId', created.id)
    setNewTitleName('')
    setShowAddTitle(false)
  }

  const onSubmit = async (values: FormValues) => {
    const result = await createEmployee.mutateAsync({
      ...values,
      joiningDate: new Date(values.joiningDate).toISOString(),
    })
    setTempPassword(result.tempPassword)
  }

  function addAnother() {
    setTempPassword(null)
    setCopied(false)
    reset({ employmentType: EmploymentType.FULL_TIME, role: UserRole.EMPLOYEE })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {tempPassword ? (
          <div className="p-6">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-foreground">Employee created</h2>
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
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{' '}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={onClose}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Back to employees
              </button>
              <button
                onClick={addAnother}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Add another
              </button>
            </div>
          </div>
        ) : (
          <>
            <SubmitOverlay show={isPending} label="Creating employee…" />
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Add employee</p>
                <p className="text-xs text-muted-foreground">Create a profile and login account</p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="shrink-0 rounded-md p-1 hover:bg-muted disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <fieldset disabled={isPending} className="contents">
              <form
                id="new-employee-form"
                onSubmit={handleSubmit(onSubmit)}
                className="scrollbar-thin space-y-5 overflow-y-auto px-5 py-4"
              >
                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First name</label>
                    <input className={field} placeholder="e.g. Nadia" {...register('firstName')} />
                    {errors.firstName && (
                      <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Last name</label>
                    <input className={field} placeholder="e.g. Islam" {...register('lastName')} />
                    {errors.lastName && (
                      <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      className={field}
                      placeholder="name@company.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      className={field}
                      placeholder="+880 1XXX-XXXXXX"
                      {...register('phone')}
                    />
                  </div>
                </div>

                {/* Office + Department */}
                <div className={offices.length > 1 ? 'grid grid-cols-2 gap-4' : ''}>
                  {offices.length > 1 && (
                    <div>
                      <label className={labelCls}>Office</label>
                      <select className={field} {...register('officeId')}>
                        <option value="">Select </option>
                        {offices.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </select>
                      {errors.officeId && (
                        <p className="mt-1 text-xs text-destructive">{errors.officeId.message}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Department</label>
                    <select
                      className={field}
                      {...register('departmentId')}
                      disabled={!selectedOffice}
                    >
                      <option value="">Select department…</option>
                      {filteredDepts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="mt-1 text-xs text-destructive">{errors.departmentId.message}</p>
                    )}
                  </div>
                </div>

                {/* Designation (Job Title) with inline add */}
                <div>
                  <label className={labelCls}>Designation</label>
                  {!showAddTitle ? (
                    <div className="flex items-center gap-2">
                      <select
                        className={field}
                        {...register('jobTitleId')}
                        disabled={!selectedDept}
                        value={selectedTitle ?? ''}
                        onChange={(e) => setValue('jobTitleId', e.target.value)}
                      >
                        <option value="">Select designation…</option>
                        {deptTitles.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {selectedDept && (
                        <button
                          type="button"
                          onClick={() => setShowAddTitle(true)}
                          className="flex shrink-0 items-center gap-1 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" /> New
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={newTitleName}
                        onChange={(e) => setNewTitleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTitle()
                          }
                        }}
                        placeholder="New designation name…"
                        className={field}
                      />
                      <button
                        type="button"
                        onClick={handleAddTitle}
                        disabled={!newTitleName.trim() || createJobTitle.isPending}
                        className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {createJobTitle.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Add'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddTitle(false)
                          setNewTitleName('')
                        }}
                        className="shrink-0 rounded-md border p-2 hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Job Grade + Employment Type + Joining Date */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Job grade</label>
                    <select
                      className={field}
                      {...register('jobGradeId')}
                      disabled={!selectedOffice}
                    >
                      <option value="">None</option>
                      {filteredGrades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Employment type</label>
                    <select className={field} {...register('employmentType')}>
                      {Object.values(EmploymentType).map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Joining date</label>
                    <input type="date" className={field} {...register('joiningDate')} />
                    {errors.joiningDate && (
                      <p className="mt-1 text-xs text-destructive">{errors.joiningDate.message}</p>
                    )}
                  </div>
                </div>

                {/* System Role */}
                <div>
                  <label className={labelCls}>System role</label>
                  <select className={field} {...register('role')}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Controls what this person can access in the system.
                  </p>
                </div>

                {createEmployee.isError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {(createEmployee.error as { response?: { data?: { error?: string } } })
                      ?.response?.data?.error ?? 'Failed to create employee'}
                  </p>
                )}
              </form>
            </fieldset>
            <div className="flex gap-2 border-t px-5 py-4">
              <button
                type="submit"
                form="new-employee-form"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isPending ? 'Creating…' : 'Create employee'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
