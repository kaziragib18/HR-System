/**
 * Demo data seed — 15 employees across BD/UK with a month of attendance,
 * leave requests, balances, and role-based logins.
 *
 * Re-runnable: it first removes any prior demo data (emails @penglobal.com).
 *
 * Run with:  npx pnpm@9 --filter @hr-system/prisma run seed:demo
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_DOMAIN = '@penglobal.com'
const hash = (pw: string) => bcrypt.hashSync(pw, 12)

interface DemoEmployee {
  key: string
  firstName: string
  lastName: string
  officeCode: 'BD' | 'UK'
  deptCode: string
  gradeLevel: number
  role: string
  type: string
  status: string
  joiningDate: string
  password: string
  managerKey?: string
}

const EMPLOYEES: DemoEmployee[] = [
  // ── BD office ──────────────────────────────────────────────────────────────
  { key: 'sarah', firstName: 'Sarah', lastName: 'Ahmed', officeCode: 'BD', deptCode: 'BD-HR', gradeLevel: 5, role: 'HR_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-03-01', password: 'Manager@123' },
  { key: 'imran', firstName: 'Imran', lastName: 'Khan', officeCode: 'BD', deptCode: 'BD-FIN', gradeLevel: 5, role: 'DEPT_HEAD', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-01-15', password: 'Password@123' },
  { key: 'mahmud', firstName: 'Mahmud', lastName: 'Alam', officeCode: 'BD', deptCode: 'BD-OPS', gradeLevel: 5, role: 'DEPT_HEAD', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-02-10', password: 'Password@123' },
  { key: 'tanvir', firstName: 'Tanvir', lastName: 'Islam', officeCode: 'BD', deptCode: 'BD-ENG', gradeLevel: 4, role: 'TEAM_LEAD', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-06-01', password: 'Password@123', managerKey: 'sarah' },
  { key: 'karim', firstName: 'Karim', lastName: 'Hossain', officeCode: 'BD', deptCode: 'BD-ENG', gradeLevel: 3, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-01-08', password: 'Employee@123', managerKey: 'tanvir' },
  { key: 'nusrat', firstName: 'Nusrat', lastName: 'Jahan', officeCode: 'BD', deptCode: 'BD-ENG', gradeLevel: 2, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-05-20', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'rakib', firstName: 'Rakib', lastName: 'Hasan', officeCode: 'BD', deptCode: 'BD-ENG', gradeLevel: 2, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'PROBATION', joiningDate: '2026-05-01', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'fatema', firstName: 'Fatema', lastName: 'Begum', officeCode: 'BD', deptCode: 'BD-FIN', gradeLevel: 3, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-02-14', password: 'Password@123', managerKey: 'imran' },
  { key: 'sadia', firstName: 'Sadia', lastName: 'Akter', officeCode: 'BD', deptCode: 'BD-OPS', gradeLevel: 2, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-07-01', password: 'Password@123', managerKey: 'mahmud' },
  { key: 'rina', firstName: 'Rina', lastName: 'Das', officeCode: 'BD', deptCode: 'BD-HR', gradeLevel: 2, role: 'EMPLOYEE', type: 'PART_TIME', status: 'ACTIVE', joiningDate: '2024-09-15', password: 'Password@123', managerKey: 'sarah' },
  { key: 'shuvo', firstName: 'Shuvo', lastName: 'Roy', officeCode: 'BD', deptCode: 'BD-ENG', gradeLevel: 1, role: 'EMPLOYEE', type: 'INTERN', status: 'PROBATION', joiningDate: '2026-06-01', password: 'Password@123', managerKey: 'tanvir' },
  // ── UK office ──────────────────────────────────────────────────────────────
  { key: 'sophie', firstName: 'Sophie', lastName: 'Brown', officeCode: 'UK', deptCode: 'UK-HR', gradeLevel: 5, role: 'HR_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-04-01', password: 'Password@123' },
  { key: 'james', firstName: 'James', lastName: 'Carter', officeCode: 'UK', deptCode: 'UK-ENG', gradeLevel: 5, role: 'DEPT_HEAD', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-05-10', password: 'Password@123', managerKey: 'sophie' },
  { key: 'emily', firstName: 'Emily', lastName: 'Watson', officeCode: 'UK', deptCode: 'UK-ENG', gradeLevel: 3, role: 'EMPLOYEE', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-03-18', password: 'Password@123', managerKey: 'james' },
  { key: 'oliver', firstName: 'Oliver', lastName: 'Smith', officeCode: 'UK', deptCode: 'UK-ENG', gradeLevel: 2, role: 'EMPLOYEE', type: 'CONTRACT', status: 'NOTICE_PERIOD', joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'james' },
]

function email(e: DemoEmployee) {
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
  await prisma.user.deleteMany({ where: { employeeId: { in: ids } } })
  // Second pass in case new records arrived after the first delete (e.g. from a stuck concurrent run)
  await prisma.attendance.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.employee.deleteMany({ where: { id: { in: ids } } })
  console.log(`✓ Cleaned up ${ids.length} prior demo employees`)
}

async function main() {
  console.log('Seeding demo data...')
  await cleanup()

  const offices = await prisma.office.findMany()
  const officeByCode = Object.fromEntries(offices.map((o) => [o.code, o]))
  const departments = await prisma.department.findMany()
  const deptByCode = Object.fromEntries(departments.map((d) => [d.code, d]))
  const grades = await prisma.jobGrade.findMany()
  const leaveTypes = await prisma.leaveType.findMany()

  const seqByPrefix: Record<string, number> = {}
  async function nextEmployeeId(officeCode: string, year: number) {
    const prefix = `${officeCode}-${year}-`
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

  // ── Create employees + users ────────────────────────────────────────────────
  const idByKey: Record<string, string> = {}
  for (const e of EMPLOYEES) {
    const office = officeByCode[e.officeCode]
    const dept = deptByCode[e.deptCode]
    const grade = grades.find((g) => g.officeId === office.id && g.level === e.gradeLevel)
    const year = new Date(e.joiningDate).getFullYear()
    const employeeId = await nextEmployeeId(e.officeCode, year)

    const emp = await prisma.employee.create({
      data: {
        employeeId,
        officeId: office.id,
        departmentId: dept.id,
        jobGradeId: grade?.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: email(e),
        phone: e.officeCode === 'BD' ? '+8801712345678' : '+447700900123',
        employmentType: e.type,
        employmentStatus: e.status,
        joiningDate: new Date(e.joiningDate),
        nationality: e.officeCode === 'BD' ? 'Bangladeshi' : 'British',
      },
    })
    idByKey[e.key] = emp.id

    await prisma.user.create({
      data: {
        employeeId: emp.id,
        email: email(e),
        passwordHash: hash(e.password),
        role: e.role,
      },
    })
  }
  console.log(`✓ Created ${EMPLOYEES.length} employees + logins`)

  // ── Reporting lines ─────────────────────────────────────────────────────────
  for (const e of EMPLOYEES) {
    if (e.managerKey && idByKey[e.managerKey]) {
      await prisma.employee.update({
        where: { id: idByKey[e.key] },
        data: { reportingToId: idByKey[e.managerKey] },
      })
    }
  }

  // Department managers (nice org data)
  await prisma.department.update({ where: { code: 'BD-HR' }, data: { managerId: idByKey['sarah'] } })
  await prisma.department.update({ where: { code: 'BD-FIN' }, data: { managerId: idByKey['imran'] } })
  await prisma.department.update({ where: { code: 'BD-OPS' }, data: { managerId: idByKey['mahmud'] } })
  await prisma.department.update({ where: { code: 'BD-ENG' }, data: { managerId: idByKey['tanvir'] } })
  await prisma.department.update({ where: { code: 'UK-ENG' }, data: { managerId: idByKey['james'] } })
  await prisma.department.update({ where: { code: 'UK-HR' }, data: { managerId: idByKey['sophie'] } })
  console.log('✓ Reporting lines + department managers set')

  // ── Leave balances (2026) ────────────────────────────────────────────────────
  const year = new Date().getFullYear()
  for (const e of EMPLOYEES) {
    const office = officeByCode[e.officeCode]
    const officeLeaveTypes = leaveTypes.filter((lt) => lt.officeId === office.id)
    for (const lt of officeLeaveTypes) {
      const entitled = Number(lt.daysPerYear)
      const taken = Math.floor(Math.random() * Math.min(5, entitled))
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: idByKey[e.key], leaveTypeId: lt.id, year } },
        update: { entitled, taken },
        create: { employeeId: idByKey[e.key], leaveTypeId: lt.id, year, entitled, taken },
      })
    }
  }
  console.log('✓ Leave balances created')

  // ── Leave applications ────────────────────────────────────────────────────────
  const bdLeave = (code: string) =>
    leaveTypes.find((lt) => lt.officeId === officeByCode['BD'].id && lt.code === code)!
  const today = dateOnly(new Date())
  const addDays = (d: Date, n: number) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  }

  // Two APPROVED leaves covering today → onLeaveToday = 2
  await prisma.leaveApplication.create({
    data: {
      employeeId: idByKey['karim'],
      leaveTypeId: bdLeave('AL').id,
      startDate: addDays(today, -1),
      endDate: addDays(today, 1),
      totalDays: 3,
      reason: 'Family event',
      status: 'APPROVED',
      approvedById: idByKey['tanvir'],
      approvedAt: addDays(today, -3),
    },
  })
  await prisma.leaveApplication.create({
    data: {
      employeeId: idByKey['nusrat'],
      leaveTypeId: bdLeave('SL').id,
      startDate: today,
      endDate: today,
      totalDays: 1,
      reason: 'Fever',
      status: 'APPROVED',
      approvedById: idByKey['sarah'],
      approvedAt: today,
    },
  })

  // Three PENDING leaves → pendingLeaves = 3, populates approval queue
  const pending: Array<[string, string, number, number, string]> = [
    ['fatema', 'AL', 5, 7, 'Vacation'],
    ['sadia', 'CL', 10, 10, 'Personal work'],
    ['rina', 'AL', 8, 9, 'Travel'],
  ]
  for (const [key, code, startOffset, endOffset, reason] of pending) {
    const lt = bdLeave(code)
    await prisma.leaveApplication.create({
      data: {
        employeeId: idByKey[key],
        leaveTypeId: lt.id,
        startDate: addDays(today, startOffset),
        endDate: addDays(today, endOffset),
        totalDays: endOffset - startOffset + 1,
        reason,
        status: 'PENDING',
        approvalLevel: 1,
        currentApproverId: idByKey['sarah'],
      },
    })
  }

  // A couple of past APPROVED leaves
  await prisma.leaveApplication.create({
    data: {
      employeeId: idByKey['karim'],
      leaveTypeId: bdLeave('CL').id,
      startDate: addDays(today, -20),
      endDate: addDays(today, -20),
      totalDays: 1,
      reason: 'Errand',
      status: 'APPROVED',
      approvedById: idByKey['tanvir'],
      approvedAt: addDays(today, -22),
    },
  })
  console.log('✓ Leave applications created (2 on leave today, 3 pending, 1 past)')

  // ── Attendance: last 30 days ──────────────────────────────────────────────────
  // Build all records in-memory first, then batch insert (much faster than 450 individual upserts)
  const onLeaveToday = new Set([idByKey['karim'], idByKey['nusrat']])

  // Deterministic pseudo-random (avoids Math.random variance across runs)
  function seededRoll(empIdx: number, offset: number): number {
    return ((empIdx * 31 + offset * 17) % 100) / 100
  }

  // Delete existing attendance for these employees to allow createMany
  const empIds = EMPLOYEES.map(e => idByKey[e.key])
  await prisma.attendance.deleteMany({ where: { employeeId: { in: empIds } } })

  const attendanceRows: {
    employeeId: string; date: Date; status: string; checkIn: Date | null; checkOut: Date | null
    lateMinutes: number; workingMinutes: number; overtimeMinutes: number; source: string
  }[] = []

  EMPLOYEES.forEach((e, empIdx) => {
    const empId = idByKey[e.key]
    const joining = new Date(e.joiningDate)

    for (let offset = 30; offset >= 0; offset--) {
      const day = dateOnly(addDays(today, -offset))
      if (day < dateOnly(joining)) continue

      const dow = day.getDay()
      const isWeekend = dow === 0 || dow === 6
      const isToday = offset === 0

      let status = 'PRESENT'
      let checkIn: Date | null = null
      let checkOut: Date | null = null
      let lateMinutes = 0
      let workingMinutes = 0
      let overtimeMinutes = 0

      if (isWeekend) {
        status = 'WEEKEND'
      } else if (isToday && onLeaveToday.has(empId)) {
        status = 'ON_LEAVE'
      } else {
        const roll = seededRoll(empIdx, offset)
        const isBD = e.officeCode === 'BD'
        // BD: shift 13:30–22:00, UK: shift 09:00–17:00
        const shiftStartH = isBD ? 13 : 9
        const shiftStartM = isBD ? 30 : 0
        const shiftEndH   = isBD ? 22 : 17
        const shiftDurMins = isBD ? (22 - 13) * 60 - 30 : (17 - 9) * 60  // 510 for BD, 480 for UK

        if (roll < 0.05) {
          status = 'ABSENT'
        } else if (roll < 0.18) {
          status = 'LATE'
          const lateBy = 16 + (empIdx * 7 + offset * 3) % 35
          checkIn = atTime(day, shiftStartH, shiftStartM + lateBy)
          checkOut = atTime(day, shiftEndH, (empIdx + offset) % 30)
          lateMinutes = lateBy - 15
          workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
        } else {
          status = 'PRESENT'
          const earlyMins = (empIdx + offset) % 15  // arrive 0–14 min before shift start
          checkIn = atTime(day, shiftStartH, shiftStartM - earlyMins)
          checkOut = atTime(day, shiftEndH, (empIdx * 3 + offset) % 45)
          workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
          overtimeMinutes = Math.max(0, workingMinutes - shiftDurMins)
        }
      }

      attendanceRows.push({ employeeId: empId, date: day, status, checkIn, checkOut, lateMinutes, workingMinutes, overtimeMinutes, source: 'BIOMETRIC' })
    }
  })

  await prisma.attendance.createMany({ data: attendanceRows })
  console.log(`✓ Created ${attendanceRows.length} attendance records (last 30 days)`)

  // ── Payroll: current month (PAID) ────────────────────────────────────────────
  const now = new Date()
  const PM = now.getMonth() + 1
  const PY = now.getFullYear()

  // Remove any existing payroll runs for this month/offices so the seed is re-runnable
  await prisma.payrollRun.deleteMany({
    where: { month: PM, year: PY, officeId: { in: [officeByCode['BD'].id, officeByCode['UK'].id] } },
  })

  // ── Tax helpers ───────────────────────────────────────────────────────────────
  function bdTax(annualGross: number) {
    const SLABS = [
      { from: 0,       to: 350000  as number | undefined, rate: 0,    label: 'First BDT 3,50,000' },
      { from: 350000,  to: 450000  as number | undefined, rate: 0.05, label: 'Next BDT 1,00,000' },
      { from: 450000,  to: 750000  as number | undefined, rate: 0.10, label: 'Next BDT 3,00,000' },
      { from: 750000,  to: 1150000 as number | undefined, rate: 0.15, label: 'Next BDT 4,00,000' },
      { from: 1150000, to: 1550000 as number | undefined, rate: 0.20, label: 'Next BDT 4,00,000' },
      { from: 1550000, to: undefined,                     rate: 0.25, label: 'Above BDT 15,50,000' },
    ]
    let remaining = annualGross, total = 0
    const slabs = []
    for (const s of SLABS) {
      if (remaining <= 0) break
      const size = s.to !== undefined ? s.to - s.from : remaining
      const taxable = Math.min(remaining, size)
      const taxAmount = Math.round(taxable * s.rate)
      total += taxAmount
      slabs.push({ from: s.from, to: s.to, rate: s.rate, taxAmount, label: s.label })
      remaining -= taxable
    }
    return { regime: 'BD_INCOME_TAX', taxableIncome: annualGross, totalTax: total, slabs }
  }

  function calcSlabTax(gross: number, slabs: Array<{ from: number; to: number | undefined; rate: number; label: string }>) {
    let total = 0
    const result = []
    for (const s of slabs) {
      if (gross <= s.from) break
      const taxable = s.to !== undefined ? Math.min(gross, s.to) - s.from : gross - s.from
      const taxAmount = Math.round(Math.max(0, taxable) * s.rate)
      total += taxAmount
      result.push({ from: s.from, to: s.to, rate: s.rate, taxAmount, label: s.label })
    }
    return { total, slabs: result }
  }

  function ukTax(annualGross: number) {
    const taxSlabs = [
      { from: 0,      to: 12570   as number | undefined, rate: 0,    label: 'Tax: Personal allowance' },
      { from: 12570,  to: 50270   as number | undefined, rate: 0.20, label: 'Tax: Basic rate (20%)' },
      { from: 50270,  to: 125140  as number | undefined, rate: 0.40, label: 'Tax: Higher rate (40%)' },
      { from: 125140, to: undefined,                     rate: 0.45, label: 'Tax: Additional rate (45%)' },
    ]
    const niSlabs = [
      { from: 0,     to: 12570  as number | undefined, rate: 0,    label: 'NI: Below Primary Threshold' },
      { from: 12570, to: 50270  as number | undefined, rate: 0.08, label: 'NI: Primary rate (8%)' },
      { from: 50270, to: undefined,                    rate: 0.02, label: 'NI: Above Upper Earnings Limit (2%)' },
    ]
    const tax = calcSlabTax(annualGross, taxSlabs)
    const ni  = calcSlabTax(annualGross, niSlabs)
    return {
      regime: 'UK_PAYE',
      taxableIncome: Math.max(0, annualGross - 12570),
      totalTax: tax.total + ni.total,
      slabs: [...tax.slabs, ...ni.slabs],
    }
  }

  // ── BD payroll ────────────────────────────────────────────────────────────────
  // [key, basicSalary (BDT/mo), presentDays, leaveDays]
  const BD_PAY: Array<[string, number, number, number]> = [
    ['sarah',  120000, 21, 0],
    ['imran',  120000, 22, 0],
    ['mahmud', 120000, 21, 0],
    ['tanvir',  85000, 22, 0],
    ['karim',   60000, 18, 2], // 2 days approved leave this month
    ['nusrat',  40000, 19, 1], // 1 day approved leave
    ['rakib',   40000, 20, 0],
    ['fatema',  60000, 22, 0],
    ['sadia',   40000, 21, 0],
    ['rina',    40000, 21, 0],
    ['shuvo',   25000, 20, 0],
  ]
  const WORKING_DAYS = 22

  const bdRun = await prisma.payrollRun.create({
    data: {
      officeId: officeByCode['BD'].id,
      month: PM, year: PY,
      status: 'PAID',
      currency: 'BDT',
      totalGross: 0, totalNet: 0, totalTax: 0,
      employeeCount: BD_PAY.length,
      processedAt: now,
      approvedAt: now,
      approvedById: idByKey['sarah'],
    },
  })

  let bdGross = 0, bdTax_ = 0, bdNet = 0
  for (const [key, basic, presentDays, leaveDays] of BD_PAY) {
    if (!idByKey[key]) continue
    const allowances = Math.round(basic * 0.5)          // 40% HRA + 10% medical
    const gross = basic + allowances
    const tbd = bdTax(gross * 12)
    const monthlyTax = Math.round(tbd.totalTax / 12)
    const pf = Math.round(basic * 0.1)
    const absentDays = Math.max(0, WORKING_DAYS - presentDays - leaveDays)
    const absentDeduction = Math.round((gross / WORKING_DAYS) * absentDays)
    const finalGross = gross - absentDeduction
    const netSalary = Math.max(0, finalGross - monthlyTax - pf)

    await prisma.payrollEntry.create({
      data: {
        payrollRunId: bdRun.id,
        employeeId: idByKey[key],
        grossSalary: finalGross,
        basicSalary: basic,
        allowances,
        overtimePay: 0,
        deductions: absentDeduction,
        taxAmount: monthlyTax,
        pfContribution: pf,
        netSalary,
        currency: 'BDT',
        workingDays: WORKING_DAYS,
        presentDays,
        leaveDays,
        overtimeMinutes: 0,
        taxBreakdown: tbd,
      },
    })
    bdGross += finalGross; bdTax_ += monthlyTax; bdNet += netSalary
  }
  await prisma.payrollRun.update({ where: { id: bdRun.id }, data: { totalGross: bdGross, totalTax: bdTax_, totalNet: bdNet } })
  console.log(`✓ BD payroll run ${PM}/${PY} (PAID) — ${BD_PAY.length} employees, BDT ${bdNet.toLocaleString()} net`)

  // ── UK payroll ────────────────────────────────────────────────────────────────
  // [key, basicSalary (GBP/mo), presentDays]
  const UK_PAY: Array<[string, number, number]> = [
    ['sophie', 9000, 22],
    ['james',  9000, 21],
    ['emily',  5000, 22],
    ['oliver', 3500, 20],
  ]

  const ukRun = await prisma.payrollRun.create({
    data: {
      officeId: officeByCode['UK'].id,
      month: PM, year: PY,
      status: 'PAID',
      currency: 'GBP',
      totalGross: 0, totalNet: 0, totalTax: 0,
      employeeCount: UK_PAY.length,
      processedAt: now,
      approvedAt: now,
      approvedById: idByKey['sophie'],
    },
  })

  let ukGross = 0, ukTax_ = 0, ukNet = 0
  for (const [key, basic, presentDays] of UK_PAY) {
    if (!idByKey[key]) continue
    const londonAllowance = Math.round(basic * 0.05)    // 5% London allowance
    const gross = basic + londonAllowance
    const tbd = ukTax(gross * 12)
    const monthlyTax = Math.round(tbd.totalTax / 12)
    const absentDays = Math.max(0, WORKING_DAYS - presentDays)
    const absentDeduction = Math.round((gross / WORKING_DAYS) * absentDays)
    const finalGross = gross - absentDeduction
    const netSalary = Math.max(0, finalGross - monthlyTax)

    await prisma.payrollEntry.create({
      data: {
        payrollRunId: ukRun.id,
        employeeId: idByKey[key],
        grossSalary: finalGross,
        basicSalary: basic,
        allowances: londonAllowance,
        overtimePay: 0,
        deductions: absentDeduction,
        taxAmount: monthlyTax,
        pfContribution: 0,
        netSalary,
        currency: 'GBP',
        workingDays: WORKING_DAYS,
        presentDays,
        leaveDays: 0,
        overtimeMinutes: 0,
        taxBreakdown: tbd,
      },
    })
    ukGross += finalGross; ukTax_ += monthlyTax; ukNet += netSalary
  }
  await prisma.payrollRun.update({ where: { id: ukRun.id }, data: { totalGross: ukGross, totalTax: ukTax_, totalNet: ukNet } })
  console.log(`✓ UK payroll run ${PM}/${PY} (PAID) — ${UK_PAY.length} employees, GBP ${ukNet.toLocaleString()} net`)

  console.log('\n──────────────────────────────────────────────')
  console.log('Demo logins (all in the BD/UK demo dataset):')
  console.log('  SUPER ADMIN : admin@company.com        / Admin@123    (sees all offices)')
  console.log('  HR MANAGER  : sarah.ahmed@penglobal.com / Manager@123  (BD office)')
  console.log('  EMPLOYEE    : karim.hossain@penglobal.com / Employee@123 (BD, Engineering)')
  console.log('  (all other demo staff use password: Password@123)')
  console.log('──────────────────────────────────────────────')
  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
