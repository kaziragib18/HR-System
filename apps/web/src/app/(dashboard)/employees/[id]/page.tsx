'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useEmployee, useUpdateEmployee } from '@/lib/api/hooks/useEmployees'
import { useAuthStore } from '@/store/auth.store'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useEmployeeSearch } from '@/lib/api/hooks/useDepartments'
import { useJobGrades, useJobTitles, useOffices } from '@/lib/api/hooks/useReference'
import { Card, Avatar, StatusBadge, Spinner, PageHeader } from '@/components/ui/primitives'
import { UserRole, EmploymentType, EmploymentStatus } from '@hr-system/types'
import { formatDate } from '@hr-system/utils'
import { Pencil, X, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Read-only field ──────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

// ─── Editable section wrapper ─────────────────────────────────────────────────

function SectionCard({
  title,
  editing,
  canEdit,
  saving,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string
  editing: boolean
  canEdit: boolean
  saving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {canEdit && !editing && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {children}
    </Card>
  )
}

// ─── Form input helpers ───────────────────────────────────────────────────────

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder = '— Select —',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Reports-to combobox ──────────────────────────────────────────────────────

function ReportsToField({
  currentName,
  currentId,
  onChange,
}: {
  currentName: string
  currentId: string
  onChange: (id: string, name: string) => void
}) {
  const [query, setQuery]     = useState(currentName)
  const [open, setOpen]       = useState(false)
  const { data: results = [], isFetching } = useEmployeeSearch(query)

  useEffect(() => { setQuery(currentName) }, [currentName])

  return (
    <div className="relative">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">Reports to</label>
      <div className="relative mt-0.5">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search employee…"
          className="h-8 w-full rounded border bg-background pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {currentId && query && (
          <button
            onClick={() => { onChange('', ''); setQuery('') }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto py-1">
              {results.map(e => (
                <li key={e.id}>
                  <button
                    onMouseDown={() => {
                      onChange(e.id, `${e.firstName} ${e.lastName}`)
                      setQuery(`${e.firstName} ${e.lastName}`)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="text-xs font-medium">{e.firstName} {e.lastName}</span>
                    {e.jobTitle && (
                      <span className="text-[10px] text-muted-foreground">· {e.jobTitle.name}</span>
                    )}
                    {e.id === currentId && <Check className="ml-auto h-3 w-3 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(iso?: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// date inputs return "YYYY-MM-DD"; API requires full ISO datetime
function toISO(date: string) {
  if (!date) return undefined
  return new Date(date).toISOString()
}

function fmtType(t?: string | null) {
  return t?.replace(/_/g, ' ') ?? '—'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const params  = useParams()
  const id      = params.id as string
  const { user } = useAuthStore()
  const isSA    = user?.role === UserRole.SUPER_ADMIN

  const { data: emp, isLoading } = useEmployee(id)
  const updateEmp = useUpdateEmployee(id)

  // Reference data — always fetched so selects are ready when edit opens
  const { data: offices     = [] } = useOffices()
  const { data: departments = [] } = useDepartments()
  const { data: jobGrades   = [] } = useJobGrades()

  // ── Personal edit state ──
  const [editingP, setEditingP] = useState(false)
  const [p, setP] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', gender: '', nationality: '', nationalId: '', passportNumber: '',
  })

  function startEditP() {
    if (!emp) return
    setP({
      firstName:     emp.firstName,
      lastName:      emp.lastName,
      email:         emp.email,
      phone:         emp.phone ?? '',
      dateOfBirth:   toDateInput(emp.dateOfBirth),
      gender:        emp.gender ?? '',
      nationality:   emp.nationality ?? '',
      nationalId:    emp.nationalId ?? '',
      passportNumber: emp.passportNumber ?? '',
    })
    setEditingP(true)
  }

  async function saveP() {
    await updateEmp.mutateAsync({
      firstName:      p.firstName || undefined,
      lastName:       p.lastName || undefined,
      email:          p.email || undefined,
      phone:          p.phone || undefined,
      dateOfBirth:    toISO(p.dateOfBirth),
      gender:         p.gender || undefined,
      nationality:    p.nationality || undefined,
      nationalId:     p.nationalId || undefined,
      passportNumber: p.passportNumber || undefined,
    })
    setEditingP(false)
  }

  // ── Employment edit state ──
  const [editingE, setEditingE] = useState(false)
  const [e, setE] = useState({
    officeId: '', departmentId: '', jobTitleId: '', jobGradeId: '',
    reportingToId: '', reportingToName: '',
    employmentType: '', employmentStatus: '',
    joiningDate: '', probationEndDate: '', confirmationDate: '', lastWorkingDay: '',
  })

  const { data: jobTitles = [] } = useJobTitles(e.departmentId || undefined)

  function startEditE() {
    if (!emp) return
    setE({
      officeId:        emp.office?.id ?? '',
      departmentId:    emp.department?.id ?? '',
      jobTitleId:      emp.jobTitle?.id ?? '',
      jobGradeId:      emp.jobGrade?.id ?? '',
      reportingToId:   emp.reportingTo?.id ?? '',
      reportingToName: emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : '',
      employmentType:  emp.employmentType ?? '',
      employmentStatus: emp.employmentStatus ?? '',
      joiningDate:     toDateInput(emp.joiningDate),
      probationEndDate: toDateInput(emp.probationEndDate),
      confirmationDate: toDateInput((emp as any).confirmationDate),
      lastWorkingDay:  toDateInput((emp as any).lastWorkingDay),
    })
    setEditingE(true)
  }

  async function saveE() {
    await updateEmp.mutateAsync({
      officeId:        e.officeId || undefined,
      departmentId:    e.departmentId || undefined,
      jobTitleId:      e.jobTitleId || undefined,
      jobGradeId:      e.jobGradeId || undefined,
      reportingToId:   e.reportingToId || undefined,
      employmentType:  (e.employmentType as EmploymentType) || undefined,
      employmentStatus: (e.employmentStatus as EmploymentStatus) || undefined,
      joiningDate:     toISO(e.joiningDate),
      probationEndDate: toISO(e.probationEndDate),
      confirmationDate: toISO(e.confirmationDate),
      lastWorkingDay:  toISO(e.lastWorkingDay),
    })
    setEditingE(false)
  }

  if (isLoading) return <Spinner />
  if (!emp) return <p className="text-sm text-muted-foreground">Employee not found.</p>

  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ]

  const employmentTypeOptions = Object.values(EmploymentType).map(v => ({
    value: v,
    label: v.replace(/_/g, ' '),
  }))

  const employmentStatusOptions = Object.values(EmploymentStatus).map(v => ({
    value: v,
    label: v.replace(/_/g, ' '),
  }))

  return (
    <div>
      <PageHeader title="Employee profile" />

      {/* Header */}
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
        {/* ── Personal ── */}
        <SectionCard
          title="Personal"
          editing={editingP}
          canEdit={isSA}
          saving={updateEmp.isPending}
          onEdit={startEditP}
          onSave={saveP}
          onCancel={() => setEditingP(false)}
        >
          {!editingP ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email"         value={emp.email} />
              <Field label="Phone"         value={emp.phone} />
              <Field label="Date of birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null} />
              <Field label="Gender"        value={emp.gender} />
              <Field label="Nationality"   value={emp.nationality} />
              <Field label="National ID"   value={emp.nationalId} />
              <Field label="Passport no."  value={(emp as any).passportNumber} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name"   value={p.firstName}      onChange={v => setP(s => ({ ...s, firstName: v }))} />
              <Input label="Last name"    value={p.lastName}       onChange={v => setP(s => ({ ...s, lastName: v }))} />
              <Input label="Email"        value={p.email}          onChange={v => setP(s => ({ ...s, email: v }))} />
              <Input label="Phone"        value={p.phone}          onChange={v => setP(s => ({ ...s, phone: v }))} />
              <Input label="Date of birth" type="date" value={p.dateOfBirth} onChange={v => setP(s => ({ ...s, dateOfBirth: v }))} />
              <Select label="Gender" value={p.gender} onChange={v => setP(s => ({ ...s, gender: v }))} options={genderOptions} placeholder="— Select —" />
              <Input label="Nationality"   value={p.nationality}    onChange={v => setP(s => ({ ...s, nationality: v }))} />
              <Input label="National ID"   value={p.nationalId}     onChange={v => setP(s => ({ ...s, nationalId: v }))} />
              <Input label="Passport no."  value={p.passportNumber} onChange={v => setP(s => ({ ...s, passportNumber: v }))} />
            </div>
          )}
        </SectionCard>

        {/* ── Employment ── */}
        <SectionCard
          title="Employment"
          editing={editingE}
          canEdit={isSA}
          saving={updateEmp.isPending}
          onEdit={startEditE}
          onSave={saveE}
          onCancel={() => setEditingE(false)}
        >
          {!editingE ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Office"        value={`${emp.office?.name} (${emp.office?.code})`} />
              <Field label="Department"    value={emp.department?.name} />
              <Field label="Job title"     value={emp.jobTitle?.name} />
              <Field label="Job grade"     value={emp.jobGrade?.name} />
              <Field label="Type"          value={fmtType(emp.employmentType)} />
              <Field label="Status"        value={fmtType(emp.employmentStatus)} />
              <Field label="Joining date"  value={formatDate(emp.joiningDate)} />
              <Field label="Probation ends" value={emp.probationEndDate ? formatDate(emp.probationEndDate) : null} />
              <Field label="Reports to"    value={emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : null} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Office"
                value={e.officeId}
                onChange={v => setE(s => ({ ...s, officeId: v }))}
                options={offices.map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
              />
              <Select
                label="Department"
                value={e.departmentId}
                onChange={v => setE(s => ({ ...s, departmentId: v, jobTitleId: '' }))}
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
              <Select
                label="Job title"
                value={e.jobTitleId}
                onChange={v => setE(s => ({ ...s, jobTitleId: v }))}
                options={jobTitles.map(t => ({ value: t.id, label: t.name }))}
                placeholder={e.departmentId ? '— Select —' : '— Pick dept first —'}
              />
              <Select
                label="Job grade"
                value={e.jobGradeId}
                onChange={v => setE(s => ({ ...s, jobGradeId: v }))}
                options={jobGrades.map(g => ({ value: g.id, label: g.name }))}
              />
              <Select
                label="Employment type"
                value={e.employmentType}
                onChange={v => setE(s => ({ ...s, employmentType: v }))}
                options={employmentTypeOptions}
              />
              <Select
                label="Status"
                value={e.employmentStatus}
                onChange={v => setE(s => ({ ...s, employmentStatus: v }))}
                options={employmentStatusOptions}
              />
              <Input label="Joining date"     type="date" value={e.joiningDate}        onChange={v => setE(s => ({ ...s, joiningDate: v }))} />
              <Input label="Probation ends"   type="date" value={e.probationEndDate}   onChange={v => setE(s => ({ ...s, probationEndDate: v }))} />
              <Input label="Confirmation date" type="date" value={e.confirmationDate}  onChange={v => setE(s => ({ ...s, confirmationDate: v }))} />
              <Input label="Last working day" type="date" value={e.lastWorkingDay}      onChange={v => setE(s => ({ ...s, lastWorkingDay: v }))} />
              <div className="col-span-2">
                <ReportsToField
                  currentId={e.reportingToId}
                  currentName={e.reportingToName}
                  onChange={(id, name) => setE(s => ({ ...s, reportingToId: id, reportingToName: name }))}
                />
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
