'use client'

import { useState } from 'react'
import { useUpdateEmployee } from '@/lib/api/hooks/useEmployees'
import { useDepartments, departmentLabel } from '@/lib/api/hooks/useDepartments'
import { useJobGrades, useJobTitles, useOffices } from '@/lib/api/hooks/useReference'
import { SectionCard, Field, Input, Select } from '@/components/ui/section-card'
import { ReportsToField } from '@/components/employees/ReportsToField'
import { useAuthStore } from '@/store/auth.store'
import { EmploymentType, EmploymentStatus, BloodGroup } from '@hr-system/types'
import type { EmployeeProfile, Address } from '@hr-system/types'
import { formatDate } from '@hr-system/utils'

const BLANK_ADDRESS: Address = { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' }

function toAddressForm(a?: Address | null): Address {
  return a ? { line1: a.line1 ?? '', line2: a.line2 ?? '', city: a.city ?? '', state: a.state ?? '', postalCode: a.postalCode ?? '', country: a.country ?? '' } : { ...BLANK_ADDRESS }
}

function fmtAddress(a?: Address | null) {
  if (!a) return null
  return [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ')
}

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

export function EmployeeOverviewTab({
  employee: emp,
  canEditPersonal,
  canEditEmployment,
  canEditIdentity,
}: {
  employee: EmployeeProfile
  canEditPersonal: boolean
  canEditEmployment: boolean
  /** Name + email — HR_MANAGER/SUPER_ADMIN only, even when editing your own record. */
  canEditIdentity: boolean
}) {
  const updateEmp = useUpdateEmployee(emp.id)
  const { user, updateUser } = useAuthStore()
  const isSelf = user?.employeeId === emp.id
  const [error, setError] = useState('')

  const { data: offices = [] } = useOffices()
  const { data: departments = [] } = useDepartments()
  const { data: jobGrades = [] } = useJobGrades()

  // ── Personal edit state ──
  const [editingP, setEditingP] = useState(false)
  const [p, setP] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', gender: '', nationality: '', nationalId: '', passportNumber: '',
    bloodGroup: '', isBloodDonor: false, lastDonationDate: '',
  })

  function startEditP() {
    setP({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone ?? '',
      dateOfBirth: toDateInput(emp.dateOfBirth),
      gender: emp.gender ?? '',
      nationality: emp.nationality ?? '',
      nationalId: emp.nationalId ?? '',
      passportNumber: emp.passportNumber ?? '',
      bloodGroup: emp.bloodGroup ?? '',
      isBloodDonor: emp.isBloodDonor ?? false,
      lastDonationDate: toDateInput(emp.lastDonationDate),
    })
    setEditingP(true)
  }

  async function saveP() {
    setError('')
    try {
      await updateEmp.mutateAsync({
        ...(canEditIdentity ? { firstName: p.firstName || undefined, lastName: p.lastName || undefined, email: p.email || undefined } : {}),
        phone: p.phone || undefined,
        dateOfBirth: toISO(p.dateOfBirth),
        gender: p.gender || undefined,
        nationality: p.nationality || undefined,
        nationalId: p.nationalId || undefined,
        passportNumber: p.passportNumber || undefined,
        bloodGroup: (p.bloodGroup as BloodGroup) || undefined,
        isBloodDonor: p.isBloodDonor,
        lastDonationDate: p.isBloodDonor ? toISO(p.lastDonationDate) : undefined,
      })
      if (isSelf && canEditIdentity) updateUser({ firstName: p.firstName, lastName: p.lastName, email: p.email })
      setEditingP(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
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
    setE({
      officeId: emp.office?.id ?? '',
      departmentId: emp.department?.id ?? '',
      jobTitleId: emp.jobTitle?.id ?? '',
      jobGradeId: emp.jobGrade?.id ?? '',
      reportingToId: emp.reportingTo?.id ?? '',
      reportingToName: emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : '',
      employmentType: emp.employmentType ?? '',
      employmentStatus: emp.employmentStatus ?? '',
      joiningDate: toDateInput(emp.joiningDate),
      probationEndDate: toDateInput(emp.probationEndDate),
      confirmationDate: toDateInput(emp.confirmationDate),
      lastWorkingDay: toDateInput(emp.lastWorkingDay),
    })
    setEditingE(true)
  }

  async function saveE() {
    setError('')
    try {
      await updateEmp.mutateAsync({
        officeId: e.officeId || undefined,
        departmentId: e.departmentId || undefined,
        jobTitleId: e.jobTitleId || undefined,
        jobGradeId: e.jobGradeId || undefined,
        reportingToId: e.reportingToId || undefined,
        employmentType: (e.employmentType as EmploymentType) || undefined,
        employmentStatus: (e.employmentStatus as EmploymentStatus) || undefined,
        joiningDate: toISO(e.joiningDate),
        probationEndDate: toISO(e.probationEndDate),
        confirmationDate: toISO(e.confirmationDate),
        lastWorkingDay: toISO(e.lastWorkingDay),
      })
      setEditingE(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  // ── Emergency contact edit state ──
  const [editingEC, setEditingEC] = useState(false)
  const [ec, setEc] = useState({ name: '', phone: '', relation: '' })

  function startEditEC() {
    setEc({
      name: emp.emergencyContact?.name ?? '',
      phone: emp.emergencyContact?.phone ?? '',
      relation: emp.emergencyContact?.relation ?? '',
    })
    setEditingEC(true)
  }

  async function saveEC() {
    setError('')
    try {
      await updateEmp.mutateAsync({
        emergencyContact: ec.name && ec.phone && ec.relation ? ec : undefined,
      })
      setEditingEC(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  // ── Nominee information edit state ──
  const [editingNom, setEditingNom] = useState(false)
  const [nom, setNom] = useState({ name: '', relationship: '', phone: '', nationalId: '' })

  function startEditNom() {
    setNom({
      name: emp.nomineeInfo?.name ?? '',
      relationship: emp.nomineeInfo?.relationship ?? '',
      phone: emp.nomineeInfo?.phone ?? '',
      nationalId: emp.nomineeInfo?.nationalId ?? '',
    })
    setEditingNom(true)
  }

  async function saveNom() {
    setError('')
    try {
      await updateEmp.mutateAsync({
        nomineeInfo: nom.name && nom.relationship && nom.phone
          ? { name: nom.name, relationship: nom.relationship, phone: nom.phone, nationalId: nom.nationalId || undefined }
          : undefined,
      })
      setEditingNom(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  // ── Address edit state ──
  const [editingAddr, setEditingAddr] = useState(false)
  const [present, setPresent] = useState<Address>(BLANK_ADDRESS)
  const [permanent, setPermanent] = useState<Address>(BLANK_ADDRESS)
  const [sameAsPresent, setSameAsPresent] = useState(false)

  function startEditAddr() {
    setPresent(toAddressForm(emp.presentAddress))
    setPermanent(toAddressForm(emp.permanentAddress))
    setSameAsPresent(false)
    setEditingAddr(true)
  }

  function isBlankAddress(a: Address) {
    return !a.line1 && !a.city && !a.postalCode && !a.country
  }

  async function saveAddr() {
    setError('')
    const finalPermanent = sameAsPresent ? present : permanent
    try {
      await updateEmp.mutateAsync({
        presentAddress: isBlankAddress(present) ? undefined : present,
        permanentAddress: isBlankAddress(finalPermanent) ? undefined : finalPermanent,
      })
      setEditingAddr(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ]

  const bloodGroupOptions = Object.values(BloodGroup).map(v => ({ value: v, label: v }))
  const employmentTypeOptions = Object.values(EmploymentType).map(v => ({ value: v, label: v.replace(/_/g, ' ') }))
  const employmentStatusOptions = Object.values(EmploymentStatus).map(v => ({ value: v, label: v.replace(/_/g, ' ') }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {error && (
        <p className="lg:col-span-2 text-xs text-destructive">{error}</p>
      )}
      {/* ── Personal ── */}
      <SectionCard
        title="Personal"
        editing={editingP}
        canEdit={canEditPersonal}
        saving={updateEmp.isPending}
        onEdit={startEditP}
        onSave={saveP}
        onCancel={() => { setEditingP(false); setError('') }}
      >
        {!editingP ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" value={emp.email} />
            <Field label="Phone" value={emp.phone} />
            <Field label="Date of birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null} />
            <Field label="Gender" value={emp.gender} />
            <Field label="Nationality" value={emp.nationality} />
            <Field label="National ID" value={emp.nationalId} />
            <Field label="Passport no." value={emp.passportNumber} />
            <Field label="Blood group" value={emp.bloodGroup} />
            <Field label="Blood donor" value={emp.isBloodDonor ? 'Yes' : 'No'} />
            {emp.isBloodDonor && (
              <Field label="Last donation" value={emp.lastDonationDate ? formatDate(emp.lastDonationDate) : null} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {canEditIdentity ? (
              <>
                <Input label="First name" value={p.firstName} onChange={v => setP(s => ({ ...s, firstName: v }))} />
                <Input label="Last name" value={p.lastName} onChange={v => setP(s => ({ ...s, lastName: v }))} />
                <Input label="Email" value={p.email} onChange={v => setP(s => ({ ...s, email: v }))} />
              </>
            ) : (
              <>
                <Field label="Name" value={`${emp.firstName} ${emp.lastName}`} />
                <Field label="Email" value={emp.email} />
              </>
            )}
            <Input label="Phone" value={p.phone} onChange={v => setP(s => ({ ...s, phone: v }))} />
            <Input label="Date of birth" type="date" value={p.dateOfBirth} onChange={v => setP(s => ({ ...s, dateOfBirth: v }))} />
            <Select label="Gender" value={p.gender} onChange={v => setP(s => ({ ...s, gender: v }))} options={genderOptions} placeholder="— Select —" />
            <Input label="Nationality" value={p.nationality} onChange={v => setP(s => ({ ...s, nationality: v }))} />
            <Input label="National ID" value={p.nationalId} onChange={v => setP(s => ({ ...s, nationalId: v }))} />
            <Input label="Passport no." value={p.passportNumber} onChange={v => setP(s => ({ ...s, passportNumber: v }))} />
            <Select label="Blood group" value={p.bloodGroup} onChange={v => setP(s => ({ ...s, bloodGroup: v }))} options={bloodGroupOptions} placeholder="— Select —" />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={p.isBloodDonor}
                onChange={e2 => setP(s => ({ ...s, isBloodDonor: e2.target.checked }))}
              />
              I am a blood donor
            </label>
            {p.isBloodDonor && (
              <Input label="Last donation date" type="date" value={p.lastDonationDate} onChange={v => setP(s => ({ ...s, lastDonationDate: v }))} />
            )}
            {!canEditIdentity && (
              <p className="col-span-2 text-xs text-muted-foreground">
                Name and email can only be changed by HR or a Super Admin.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Employment ── */}
      <SectionCard
        title="Employment"
        editing={editingE}
        canEdit={canEditEmployment}
        saving={updateEmp.isPending}
        onEdit={startEditE}
        onSave={saveE}
        onCancel={() => { setEditingE(false); setError('') }}
      >
        {!editingE ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Office" value={`${emp.office?.name} (${emp.office?.code})`} />
            <Field label="Department" value={emp.department?.name} />
            <Field label="Job title" value={emp.jobTitle?.name} />
            <Field label="Job grade" value={emp.jobGrade?.name} />
            <Field label="Type" value={fmtType(emp.employmentType)} />
            <Field label="Status" value={fmtType(emp.employmentStatus)} />
            <Field label="Joining date" value={formatDate(emp.joiningDate)} />
            <Field label="Probation ends" value={emp.probationEndDate ? formatDate(emp.probationEndDate) : null} />
            <Field label="Reports to" value={emp.reportingTo ? `${emp.reportingTo.firstName} ${emp.reportingTo.lastName}` : null} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {offices.length > 1 && (
              <Select
                label="Office"
                value={e.officeId}
                onChange={v => setE(s => ({ ...s, officeId: v }))}
                options={offices.map(o => ({ value: o.id, label: `${o.name} (${o.code})` }))}
              />
            )}
            <Select
              label="Department"
              value={e.departmentId}
              onChange={v => setE(s => ({ ...s, departmentId: v, jobTitleId: '' }))}
              options={departments.map(d => ({ value: d.id, label: departmentLabel(d, departments) }))}
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
            <Input label="Joining date" type="date" value={e.joiningDate} onChange={v => setE(s => ({ ...s, joiningDate: v }))} />
            <Input label="Probation ends" type="date" value={e.probationEndDate} onChange={v => setE(s => ({ ...s, probationEndDate: v }))} />
            <Input label="Confirmation date" type="date" value={e.confirmationDate} onChange={v => setE(s => ({ ...s, confirmationDate: v }))} />
            <Input label="Last working day" type="date" value={e.lastWorkingDay} onChange={v => setE(s => ({ ...s, lastWorkingDay: v }))} />
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

      {/* ── Emergency Contact ── */}
      <SectionCard
        title="Emergency Contact"
        editing={editingEC}
        canEdit={canEditPersonal}
        saving={updateEmp.isPending}
        onEdit={startEditEC}
        onSave={saveEC}
        onCancel={() => { setEditingEC(false); setError('') }}
      >
        {!editingEC ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={emp.emergencyContact?.name} />
            <Field label="Phone" value={emp.emergencyContact?.phone} />
            <Field label="Relation" value={emp.emergencyContact?.relation} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={ec.name} onChange={v => setEc(s => ({ ...s, name: v }))} />
            <Input label="Phone" value={ec.phone} onChange={v => setEc(s => ({ ...s, phone: v }))} />
            <Input label="Relation" value={ec.relation} onChange={v => setEc(s => ({ ...s, relation: v }))} />
          </div>
        )}
      </SectionCard>

      {/* ── Nominee Information ── */}
      <SectionCard
        title="Nominee Information"
        editing={editingNom}
        canEdit={canEditPersonal}
        saving={updateEmp.isPending}
        onEdit={startEditNom}
        onSave={saveNom}
        onCancel={() => { setEditingNom(false); setError('') }}
      >
        {!editingNom ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={emp.nomineeInfo?.name} />
            <Field label="Relationship" value={emp.nomineeInfo?.relationship} />
            <Field label="Phone" value={emp.nomineeInfo?.phone} />
            <Field label="National ID" value={emp.nomineeInfo?.nationalId} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={nom.name} onChange={v => setNom(s => ({ ...s, name: v }))} />
            <Input label="Relationship" value={nom.relationship} onChange={v => setNom(s => ({ ...s, relationship: v }))} />
            <Input label="Phone" value={nom.phone} onChange={v => setNom(s => ({ ...s, phone: v }))} />
            <Input label="National ID" value={nom.nationalId} onChange={v => setNom(s => ({ ...s, nationalId: v }))} />
          </div>
        )}
      </SectionCard>

      {/* ── Address ── */}
      <SectionCard
        title="Address"
        editing={editingAddr}
        canEdit={canEditPersonal}
        saving={updateEmp.isPending}
        onEdit={startEditAddr}
        onSave={saveAddr}
        onCancel={() => { setEditingAddr(false); setError('') }}
      >
        {!editingAddr ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Present address" value={fmtAddress(emp.presentAddress)} />
            <Field label="Permanent address" value={fmtAddress(emp.permanentAddress)} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Present address</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Address line 1" value={present.line1} onChange={v => setPresent(s => ({ ...s, line1: v }))} />
                <Input label="Address line 2" value={present.line2 ?? ''} onChange={v => setPresent(s => ({ ...s, line2: v }))} />
                <Input label="City" value={present.city} onChange={v => setPresent(s => ({ ...s, city: v }))} />
                <Input label="State" value={present.state ?? ''} onChange={v => setPresent(s => ({ ...s, state: v }))} />
                <Input label="Postal code" value={present.postalCode} onChange={v => setPresent(s => ({ ...s, postalCode: v }))} />
                <Input label="Country" value={present.country} onChange={v => setPresent(s => ({ ...s, country: v }))} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Permanent address</p>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={sameAsPresent} onChange={e2 => setSameAsPresent(e2.target.checked)} />
                  Same as present
                </label>
              </div>
              {!sameAsPresent && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Address line 1" value={permanent.line1} onChange={v => setPermanent(s => ({ ...s, line1: v }))} />
                  <Input label="Address line 2" value={permanent.line2 ?? ''} onChange={v => setPermanent(s => ({ ...s, line2: v }))} />
                  <Input label="City" value={permanent.city} onChange={v => setPermanent(s => ({ ...s, city: v }))} />
                  <Input label="State" value={permanent.state ?? ''} onChange={v => setPermanent(s => ({ ...s, state: v }))} />
                  <Input label="Postal code" value={permanent.postalCode} onChange={v => setPermanent(s => ({ ...s, postalCode: v }))} />
                  <Input label="Country" value={permanent.country} onChange={v => setPermanent(s => ({ ...s, country: v }))} />
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
