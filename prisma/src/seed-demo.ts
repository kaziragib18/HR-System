/**
 * Demo data seed — employees covering every designation in every department.
 *
 * Re-runnable: removes prior demo data (@xyztech.com emails) first.
 *
 * Run with:  npx pnpm@9 --filter @hr-system/prisma run seed:demo
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_DOMAIN = '@xyztech.com'
const hash = (pw: string) => bcrypt.hashSync(pw, 12)

interface DemoEmployee {
  key: string
  firstName: string
  lastName: string
  deptCode: string
  jobTitleName: string
  gradeLevel: number
  role: string
  type: string
  status: string
  joiningDate: string
  password: string
  managerKey?: string
}

const EMPLOYEES: DemoEmployee[] = [
  // ── Accounts ──────────────────────────────────────────────────────────────
  { key: 'nadia',  firstName: 'Nadia',   lastName: 'Islam',     deptCode: 'ACC',   jobTitleName: 'Director of Finance and Accounts',               gradeLevel: 6, role: 'DEPT_HEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-01-10', password: 'Password@123' },
  { key: 'hassan', firstName: 'Hassan',  lastName: 'Mahmud',    deptCode: 'ACC',   jobTitleName: 'Assistant Accounts Manager',                     gradeLevel: 4, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-05-01', password: 'Password@123', managerKey: 'nadia' },
  { key: 'arif',   firstName: 'Arif',    lastName: 'Rahman',    deptCode: 'ACC',   jobTitleName: 'Accounts Team Leader',                           gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-06-01', password: 'Employee@123', managerKey: 'nadia' },
  { key: 'mita',   firstName: 'Mita',    lastName: 'Roy',       deptCode: 'ACC',   jobTitleName: 'Accounts Assistant',                             gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-03-15', password: 'Password@123', managerKey: 'arif' },

  // ── Admissions ────────────────────────────────────────────────────────────
  { key: 'jawad',  firstName: 'Jawad',   lastName: 'Uddin',     deptCode: 'ADM',   jobTitleName: 'Director of Operations and Business Development', gradeLevel: 6, role: 'DEPT_HEAD',  type: 'FULL_TIME', status: 'ACTIVE',   joiningDate: '2023-02-01', password: 'Password@123' },
  { key: 'kabir',  firstName: 'Kabir',   lastName: 'Hossain',   deptCode: 'ADM',   jobTitleName: 'Senior Admissions Officer',                      gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-08-01', password: 'Password@123', managerKey: 'jawad' },
  { key: 'sadia',  firstName: 'Sadia',   lastName: 'Akter',     deptCode: 'ADM',   jobTitleName: 'Admissions Officer & Interviewer',               gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-01-08', password: 'Password@123', managerKey: 'jawad' },
  { key: 'puja',   firstName: 'Puja',    lastName: 'Sen',       deptCode: 'ADM',   jobTitleName: 'Admissions Coordinator',                         gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-06-10', password: 'Password@123', managerKey: 'kabir' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { key: 'imran',  firstName: 'Imran',   lastName: 'Khan',      deptCode: 'FIN',   jobTitleName: 'Lead Payments Officer',                          gradeLevel: 5, role: 'DEPT_HEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-01-15', password: 'Password@123' },
  { key: 'fatema', firstName: 'Fatema',  lastName: 'Begum',     deptCode: 'FIN',   jobTitleName: 'Payments Officer',                               gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-02-14', password: 'Password@123', managerKey: 'imran' },

  // ── Human Resources ───────────────────────────────────────────────────────
  { key: 'sarah',  firstName: 'Sarah',   lastName: 'Ahmed',     deptCode: 'HR',    jobTitleName: 'Director of People Experience',                  gradeLevel: 6, role: 'HR_MANAGER', type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-03-01', password: 'Manager@123' },
  { key: 'riya',   firstName: 'Riya',    lastName: 'Sultana',   deptCode: 'HR',    jobTitleName: 'HR Assistant Manager',                           gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-11-01', password: 'Password@123', managerKey: 'sarah' },
  { key: 'rina',   firstName: 'Rina',    lastName: 'Das',       deptCode: 'HR',    jobTitleName: 'HR Assistant',                                   gradeLevel: 2, role: 'EMPLOYEE',   type: 'PART_TIME', status: 'ACTIVE',    joiningDate: '2024-09-15', password: 'Password@123', managerKey: 'sarah' },

  // ── Information Technology ────────────────────────────────────────────────
  { key: 'tanvir', firstName: 'Tanvir',  lastName: 'Islam',     deptCode: 'IT',    jobTitleName: 'Director of IT',                                 gradeLevel: 6, role: 'DEPT_HEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-04-01', password: 'Password@123' },
  { key: 'salam',  firstName: 'Salam',   lastName: 'Chowdhury', deptCode: 'IT',    jobTitleName: 'IT Manager',                                     gradeLevel: 4, role: 'TEAM_LEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-09-01', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'mehedi', firstName: 'Mehedi',  lastName: 'Hasan',     deptCode: 'IT',    jobTitleName: 'System Administrator',                           gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-01-20', password: 'Password@123', managerKey: 'salam' },

  // ── IT (Software Development) ─────────────────────────────────────────────
  { key: 'karim',  firstName: 'Karim',   lastName: 'Hossain',   deptCode: 'IT-SW', jobTitleName: 'Software Engineering Manager',                   gradeLevel: 5, role: 'TEAM_LEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-06-01', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'rakib',  firstName: 'Rakib',   lastName: 'Hasan',     deptCode: 'IT-SW', jobTitleName: 'Senior PHP Developer',                           gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'PROBATION', joiningDate: '2026-05-01', password: 'Password@123', managerKey: 'karim' },
  { key: 'nusrat', firstName: 'Nusrat',  lastName: 'Jahan',     deptCode: 'IT-SW', jobTitleName: 'React Developer',                                gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-05-20', password: 'Password@123', managerKey: 'karim' },

  // ── IT (Tech Support) ─────────────────────────────────────────────────────
  { key: 'masum',  firstName: 'Masum',   lastName: 'Hossain',   deptCode: 'IT-TS', jobTitleName: 'Project Manager',                                gradeLevel: 4, role: 'TEAM_LEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-07-15', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'shahed', firstName: 'Shahed',  lastName: 'Ali',       deptCode: 'IT-TS', jobTitleName: 'Infrastructure Technician',                      gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-10-01', password: 'Password@123', managerKey: 'masum' },
  { key: 'rubel',  firstName: 'Rubel',   lastName: 'Mia',       deptCode: 'IT-TS', jobTitleName: 'Cloud Engineer',                                 gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-03-01', password: 'Password@123', managerKey: 'masum' },
  { key: 'shuvo',  firstName: 'Shuvo',   lastName: 'Roy',       deptCode: 'IT-TS', jobTitleName: 'IT Technician',                                  gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'PROBATION', joiningDate: '2026-06-01', password: 'Password@123', managerKey: 'masum' },
  { key: 'sagor',  firstName: 'Sagor',   lastName: 'Miah',      deptCode: 'IT-TS', jobTitleName: 'Tech Support',                                   gradeLevel: 1, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'masum' },
  { key: 'rafi',   firstName: 'Rafi',    lastName: 'Islam',     deptCode: 'IT-TS', jobTitleName: 'Tech Support Specialist',                        gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-11-01', password: 'Password@123', managerKey: 'masum' },

  // ── IT (Web Development) ──────────────────────────────────────────────────
  { key: 'habib',  firstName: 'Habib',   lastName: 'Ullah',     deptCode: 'IT-WD', jobTitleName: 'Line Manager',                                   gradeLevel: 4, role: 'TEAM_LEAD',  type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-05-15', password: 'Password@123', managerKey: 'karim' },
  { key: 'rajib',  firstName: 'Rajib',   lastName: 'Ahmed',     deptCode: 'IT-WD', jobTitleName: 'Web Developer',                                  gradeLevel: 3, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-04-01', password: 'Password@123', managerKey: 'habib' },
  { key: 'priya',  firstName: 'Priya',   lastName: 'Sharma',    deptCode: 'IT-WD', jobTitleName: 'UI/UX Designer',                                 gradeLevel: 2, role: 'EMPLOYEE',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-07-10', password: 'Password@123', managerKey: 'habib' },
]

function empEmail(e: DemoEmployee) {
  return `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}${DEMO_DOMAIN}`
}

function atTime(day: Date, h: number, m: number) {
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

function dateOnly(day: Date) {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

async function cleanup() {
  const demo = await prisma.employee.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true },
  })
  const ids = demo.map((d) => d.id)
  if (ids.length === 0) return
  await prisma.leaveApprovalHistory.deleteMany({ where: { application: { employeeId: { in: ids } } } })
  await prisma.leaveApplication.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.attendance.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.timesheetEntry.deleteMany({ where: { timesheet: { employeeId: { in: ids } } } })
  await prisma.timesheet.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.notification.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.onboardingTask.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.bankInfo.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.complianceDoc.deleteMany({ where: { uploadedById: { in: ids } } })
  await prisma.user.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.employee.deleteMany({ where: { id: { in: ids } } })
  console.log(`✓ Cleaned up ${ids.length} prior demo employees`)
}

async function main() {
  console.log('Seeding demo data...')
  await cleanup()

  const offices        = await prisma.office.findMany()
  const officeByCode   = Object.fromEntries(offices.map((o) => [o.code, o]))
  const bdOffice       = officeByCode['BD']
  const departments    = await prisma.department.findMany()
  const deptByCode     = Object.fromEntries(departments.map((d) => [d.code, d]))
  const grades         = await prisma.jobGrade.findMany()
  const leaveTypes     = await prisma.leaveType.findMany()
  const allTitles      = await prisma.jobTitle.findMany({ where: { isActive: true } })

  const seqByPrefix: Record<string, number> = {}
  async function nextEmployeeId(year: number) {
    const prefix = `BD-${year}-`
    if (seqByPrefix[prefix] === undefined) {
      const last = await prisma.employee.findFirst({
        where: { employeeId: { startsWith: prefix } },
        orderBy: { employeeId: 'desc' },
        select: { employeeId: true },
      })
      seqByPrefix[prefix] = last ? parseInt(last.employeeId.slice(prefix.length), 10) : 0
    }
    seqByPrefix[prefix] += 1
    return `${prefix}${String(seqByPrefix[prefix]).padStart(3, '0')}`
  }

  // ── Create employees + users ─────────────────────────────────────────────
  const idByKey: Record<string, string> = {}
  for (const e of EMPLOYEES) {
    const dept = deptByCode[e.deptCode]
    if (!dept) { console.warn(`  ⚠ dept not found: ${e.deptCode} — skipping ${e.key}`); continue }

    const grade = grades.find((g) => g.officeId === bdOffice.id && g.level === e.gradeLevel)
    const title = allTitles.find((t) => t.departmentId === dept.id && t.name === e.jobTitleName)
    if (!title) console.warn(`  ⚠ job title not found: "${e.jobTitleName}" in ${e.deptCode}`)

    const year       = new Date(e.joiningDate).getFullYear()
    const employeeId = await nextEmployeeId(year)

    const emp = await prisma.employee.create({
      data: {
        employeeId,
        officeId:         bdOffice.id,
        departmentId:     dept.id,
        jobGradeId:       grade?.id,
        jobTitleId:       title?.id,
        firstName:        e.firstName,
        lastName:         e.lastName,
        email:            empEmail(e),
        phone:            '+8801712345678',
        employmentType:   e.type,
        employmentStatus: e.status,
        joiningDate:      new Date(e.joiningDate),
        nationality:      'Bangladeshi',
      },
    })
    idByKey[e.key] = emp.id

    await prisma.user.create({
      data: {
        employeeId:   emp.id,
        email:        empEmail(e),
        passwordHash: hash(e.password),
        role:         e.role,
      },
    })
  }
  console.log(`✓ Created ${EMPLOYEES.length} employees + logins`)

  // ── Reporting lines ──────────────────────────────────────────────────────
  for (const e of EMPLOYEES) {
    if (e.managerKey && idByKey[e.managerKey] && idByKey[e.key]) {
      await prisma.employee.update({
        where: { id: idByKey[e.key] },
        data:  { reportingToId: idByKey[e.managerKey] },
      })
    }
  }

  // Department managers
  const deptManagerMap: Record<string, string> = {
    'ACC':   'nadia',
    'ADM':   'jawad',
    'FIN':   'imran',
    'HR':    'sarah',
    'IT':    'tanvir',
    'IT-SW': 'karim',
    'IT-TS': 'masum',
    'IT-WD': 'habib',
  }
  for (const [deptCode, key] of Object.entries(deptManagerMap)) {
    if (idByKey[key]) {
      await prisma.department.update({ where: { code: deptCode }, data: { managerId: idByKey[key] } })
    }
  }
  console.log('✓ Reporting lines + department managers set')

  // ── Leave balances (current year) ────────────────────────────────────────
  const year = new Date().getFullYear()
  const bdLeaveTypes = leaveTypes.filter((lt) => lt.officeId === bdOffice.id)
  function seededInt(empIdx: number, seed: number, max: number) {
    return ((empIdx * 31 + seed * 17) % (max + 1))
  }
  for (const [idx, e] of EMPLOYEES.entries()) {
    if (!idByKey[e.key]) continue
    for (const lt of bdLeaveTypes) {
      const entitled = Number(lt.daysPerYear)
      const taken    = seededInt(idx, lt.code.charCodeAt(0), Math.min(4, entitled))
      await prisma.leaveBalance.upsert({
        where:  { employeeId_leaveTypeId_year: { employeeId: idByKey[e.key], leaveTypeId: lt.id, year } },
        update: { entitled, taken },
        create: { employeeId: idByKey[e.key], leaveTypeId: lt.id, year, entitled, taken },
      })
    }
  }
  console.log('✓ Leave balances created')

  // ── Leave applications ───────────────────────────────────────────────────
  const bdLeave = (code: string) => bdLeaveTypes.find((lt) => lt.code === code)!
  const today = dateOnly(new Date())

  // Two employees on leave today
  await prisma.leaveApplication.create({
    data: {
      employeeId:       idByKey['karim'],
      leaveTypeId:      bdLeave('AL').id,
      startDate:        addDays(today, -1),
      endDate:          addDays(today, 1),
      totalDays:        3,
      reason:           'Family event',
      status:           'APPROVED',
      approvedById:     idByKey['sarah'],
      approvedAt:       addDays(today, -3),
    },
  })
  await prisma.leaveApplication.create({
    data: {
      employeeId:       idByKey['nusrat'],
      leaveTypeId:      bdLeave('SL').id,
      startDate:        today,
      endDate:          today,
      totalDays:        1,
      reason:           'Fever',
      status:           'APPROVED',
      approvedById:     idByKey['sarah'],
      approvedAt:       today,
    },
  })

  // Pending leaves for approval queue
  const pending: Array<[string, string, number, number, string]> = [
    ['fatema', 'AL',  5,  7, 'Annual vacation'],
    ['sadia',  'CL', 10, 10, 'Personal errand'],
    ['rina',   'AL',  8,  9, 'Travel'],
    ['rajib',  'CL',  3,  4, 'Personal work'],
  ]
  for (const [key, code, startOff, endOff, reason] of pending) {
    if (!idByKey[key]) continue
    await prisma.leaveApplication.create({
      data: {
        employeeId:         idByKey[key],
        leaveTypeId:        bdLeave(code).id,
        startDate:          addDays(today, startOff),
        endDate:            addDays(today, endOff),
        totalDays:          endOff - startOff + 1,
        reason,
        status:             'PENDING',
        approvalLevel:      1,
        currentApproverId:  idByKey['sarah'],
      },
    })
  }

  await prisma.leaveApplication.create({
    data: {
      employeeId:   idByKey['arif'],
      leaveTypeId:  bdLeave('CL').id,
      startDate:    addDays(today, -20),
      endDate:      addDays(today, -20),
      totalDays:    1,
      reason:       'Personal errand',
      status:       'APPROVED',
      approvedById: idByKey['nadia'],
      approvedAt:   addDays(today, -22),
    },
  })
  console.log('✓ Leave applications created (2 on leave today, 4 pending)')

  // ── Attendance: last 30 days ──────────────────────────────────────────────
  const onLeaveToday = new Set([idByKey['karim'], idByKey['nusrat']])
  function seededRoll(empIdx: number, offset: number) {
    return ((empIdx * 31 + offset * 17) % 100) / 100
  }

  const empIds = EMPLOYEES.map((e) => idByKey[e.key]).filter(Boolean)
  await prisma.attendance.deleteMany({ where: { employeeId: { in: empIds } } })

  const attendanceRows: {
    employeeId: string; date: Date; status: string
    checkIn: Date | null; checkOut: Date | null
    lateMinutes: number; workingMinutes: number; overtimeMinutes: number; source: string
  }[] = []

  EMPLOYEES.forEach((e, empIdx) => {
    const empId  = idByKey[e.key]
    if (!empId) return
    const joining = new Date(e.joiningDate)

    for (let offset = 30; offset >= 0; offset--) {
      const day    = dateOnly(addDays(today, -offset))
      if (day < dateOnly(joining)) continue
      const dow        = day.getDay()
      const isWeekend  = dow === 0 || dow === 6
      const isToday    = offset === 0

      let status = 'PRESENT', checkIn: Date | null = null, checkOut: Date | null = null
      let lateMinutes = 0, workingMinutes = 0, overtimeMinutes = 0

      if (isWeekend) {
        status = 'WEEKEND'
      } else if (isToday && onLeaveToday.has(empId)) {
        status = 'ON_LEAVE'
      } else {
        const roll = seededRoll(empIdx, offset)
        // BD shift: 1:30 PM – 10:00 PM (510 min)
        const shiftH = 13, shiftM = 30, endH = 22, shiftDur = 510

        if (roll < 0.05) {
          status = 'ABSENT'
        } else if (roll < 0.18) {
          status = 'LATE'
          const lateBy = 16 + (empIdx * 7 + offset * 3) % 35
          checkIn  = atTime(day, shiftH, shiftM + lateBy)
          checkOut = atTime(day, endH, (empIdx + offset) % 30)
          lateMinutes    = lateBy - 15
          workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
        } else {
          const earlyMins = (empIdx + offset) % 15
          checkIn  = atTime(day, shiftH, shiftM - earlyMins)
          checkOut = atTime(day, endH, (empIdx * 3 + offset) % 45)
          workingMinutes  = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
          overtimeMinutes = Math.max(0, workingMinutes - shiftDur)
        }
      }

      attendanceRows.push({ employeeId: empId, date: day, status, checkIn, checkOut, lateMinutes, workingMinutes, overtimeMinutes, source: 'BIOMETRIC' })
    }
  })

  await prisma.attendance.createMany({ data: attendanceRows })
  console.log(`✓ Created ${attendanceRows.length} attendance records (last 30 days)`)

  // ── Payroll: current month ────────────────────────────────────────────────
  const now = new Date()
  const PM  = now.getMonth() + 1
  const PY  = now.getFullYear()

  // Delete entries before runs to satisfy FK constraint
  const existingRuns = await prisma.payrollRun.findMany({ where: { month: PM, year: PY, officeId: bdOffice.id }, select: { id: true } })
  if (existingRuns.length) {
    await prisma.payrollEntry.deleteMany({ where: { payrollRunId: { in: existingRuns.map(r => r.id) } } })
    await prisma.payrollRun.deleteMany({ where: { id: { in: existingRuns.map(r => r.id) } } })
  }

  function bdTax(annualGross: number) {
    const SLABS = [
      { from: 0,       to: 350000  as number | undefined, rate: 0    },
      { from: 350000,  to: 450000  as number | undefined, rate: 0.05 },
      { from: 450000,  to: 750000  as number | undefined, rate: 0.10 },
      { from: 750000,  to: 1150000 as number | undefined, rate: 0.15 },
      { from: 1150000, to: 1550000 as number | undefined, rate: 0.20 },
      { from: 1550000, to: undefined,                     rate: 0.25 },
    ]
    let remaining = annualGross, total = 0
    const slabs = []
    for (const s of SLABS) {
      if (remaining <= 0) break
      const size     = s.to !== undefined ? s.to - s.from : remaining
      const taxable  = Math.min(remaining, size)
      const taxAmt   = Math.round(taxable * s.rate)
      total += taxAmt
      slabs.push({ from: s.from, to: s.to, rate: s.rate, taxAmount: taxAmt })
      remaining -= taxable
    }
    return { regime: 'BD_INCOME_TAX', taxableIncome: annualGross, totalTax: total, slabs }
  }

  // [key, basicSalary BDT/month, presentDays, leaveDays]
  const BD_PAY: Array<[string, number, number, number]> = [
    ['nadia',  180000, 22, 0],
    ['hassan',  85000, 22, 0],
    ['arif',    60000, 21, 0],
    ['mita',    40000, 22, 0],
    ['jawad',  180000, 21, 0],
    ['kabir',   60000, 22, 0],
    ['sadia',   60000, 22, 0],
    ['puja',    40000, 22, 0],
    ['imran',  120000, 22, 0],
    ['fatema',  40000, 22, 0],
    ['sarah',  180000, 21, 0],
    ['riya',    60000, 22, 0],
    ['rina',    40000, 20, 0],
    ['tanvir', 180000, 22, 0],
    ['salam',   85000, 22, 0],
    ['mehedi',  60000, 22, 0],
    ['karim',  120000, 18, 2],
    ['rakib',   60000, 20, 0],
    ['nusrat',  60000, 19, 1],
    ['masum',   85000, 22, 0],
    ['shahed',  60000, 21, 0],
    ['rubel',   60000, 22, 0],
    ['shuvo',   40000, 18, 0],
    ['sagor',   25000, 21, 0],
    ['rafi',    40000, 22, 0],
    ['habib',   85000, 22, 0],
    ['rajib',   60000, 22, 0],
    ['priya',   40000, 21, 0],
  ]
  const WORKING_DAYS = 22

  const bdRun = await prisma.payrollRun.create({
    data: {
      officeId:      bdOffice.id,
      month:         PM, year: PY,
      status:        'PAID', currency: 'BDT',
      totalGross:    0, totalNet: 0, totalTax: 0,
      employeeCount: BD_PAY.filter(([k]) => !!idByKey[k]).length,
      processedAt:   now, approvedAt: now,
      approvedById:  idByKey['sarah'],
    },
  })

  let bdGross = 0, bdTaxTotal = 0, bdNet = 0
  for (const [key, basic, presentDays, leaveDays] of BD_PAY) {
    if (!idByKey[key]) continue
    const allowances     = Math.round(basic * 0.5)
    const gross          = basic + allowances
    const tbd            = bdTax(gross * 12)
    const monthlyTax     = Math.round(tbd.totalTax / 12)
    const pf             = Math.round(basic * 0.1)
    const absentDays     = Math.max(0, WORKING_DAYS - presentDays - leaveDays)
    const absentDed      = Math.round((gross / WORKING_DAYS) * absentDays)
    const finalGross     = gross - absentDed
    const netSalary      = Math.max(0, finalGross - monthlyTax - pf)
    await prisma.payrollEntry.create({
      data: {
        payrollRunId:    bdRun.id, employeeId: idByKey[key],
        grossSalary:     finalGross, basicSalary: basic, allowances,
        overtimePay:     0, deductions: absentDed, taxAmount: monthlyTax,
        pfContribution:  pf, netSalary, currency: 'BDT',
        workingDays:     WORKING_DAYS, presentDays, leaveDays, overtimeMinutes: 0,
        taxBreakdown:    tbd,
      },
    })
    bdGross += finalGross; bdTaxTotal += monthlyTax; bdNet += netSalary
  }
  await prisma.payrollRun.update({ where: { id: bdRun.id }, data: { totalGross: bdGross, totalTax: bdTaxTotal, totalNet: bdNet } })
  console.log(`✓ BD payroll run ${PM}/${PY} (PAID) — BDT ${bdNet.toLocaleString()} net, ${BD_PAY.length} employees`)

  console.log('\n──────────────────────────────────────────────────────')
  console.log('Demo logins:')
  console.log('  SUPER ADMIN  : admin@company.com              / Admin@123')
  console.log('  HR MANAGER   : sarah.ahmed@xyztech.com       / Manager@123')
  console.log('  DEPT HEAD    : nadia.islam@xyztech.com       / Password@123  (Accounts)')
  console.log('  DEPT HEAD    : jawad.uddin@xyztech.com       / Password@123  (Admissions)')
  console.log('  DEPT HEAD    : tanvir.islam@xyztech.com      / Password@123  (IT)')
  console.log('  TEAM LEAD    : karim.hossain@xyztech.com     / Password@123  (IT-SW)')
  console.log('  TEAM LEAD    : masum.hossain@xyztech.com     / Password@123  (IT-TS)')
  console.log('  TEAM LEAD    : habib.ullah@xyztech.com       / Password@123  (IT-WD)')
  console.log('  EMPLOYEE     : arif.rahman@xyztech.com       / Employee@123  (Accounts)')
  console.log('  (all other demo staff: Password@123)')
  console.log('──────────────────────────────────────────────────────')
  console.log('Done!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
