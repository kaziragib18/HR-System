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
  await prisma.notification.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.onboardingTask.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.bankInfo.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.user.deleteMany({ where: { employeeId: { in: ids } } })
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
  const onLeaveToday = new Set([idByKey['karim'], idByKey['nusrat']])
  let attendanceCount = 0

  for (const e of EMPLOYEES) {
    const empId = idByKey[e.key]
    const joining = new Date(e.joiningDate)

    for (let offset = 30; offset >= 0; offset--) {
      const day = dateOnly(addDays(today, -offset))
      if (day < dateOnly(joining)) continue // not yet joined

      const dow = day.getDay() // 0 Sun .. 6 Sat
      const isWeekend = dow === 0 || dow === 6

      let status = 'PRESENT'
      let checkIn: Date | null = null
      let checkOut: Date | null = null
      let lateMinutes = 0
      let workingMinutes = 0
      let overtimeMinutes = 0

      const isToday = offset === 0

      if (isWeekend) {
        status = 'WEEKEND'
      } else if (isToday && onLeaveToday.has(empId)) {
        status = 'ON_LEAVE'
      } else {
        const roll = Math.random()
        if (roll < 0.05) {
          status = 'ABSENT'
        } else if (roll < 0.18) {
          // LATE
          status = 'LATE'
          const lateBy = 16 + Math.floor(Math.random() * 35) // 16-50 min after 9:00
          checkIn = atTime(day, 9, lateBy)
          checkOut = atTime(day, 18, Math.floor(Math.random() * 30))
          lateMinutes = lateBy - 15 // 15 min grace
          workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
        } else {
          // PRESENT
          status = 'PRESENT'
          checkIn = atTime(day, 8, 50 + Math.floor(Math.random() * 15))
          checkOut = atTime(day, 18, Math.floor(Math.random() * 45))
          workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
          overtimeMinutes = Math.max(0, workingMinutes - 540)
        }
      }

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: empId, date: day } },
        update: { status, checkIn, checkOut, lateMinutes, workingMinutes, overtimeMinutes },
        create: {
          employeeId: empId,
          date: day,
          status,
          checkIn,
          checkOut,
          lateMinutes,
          workingMinutes,
          overtimeMinutes,
          source: 'BIOMETRIC',
        },
      })
      attendanceCount++
    }
  }
  console.log(`✓ Created ${attendanceCount} attendance records (last 30 days)`)

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
