import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Must match the API's hashing (apps/api/src/utils/hash.ts) so the seeded
// admin can log in.
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12)
}

async function main() {
  console.log('Seeding database...')

  // ─── Offices ────────────────────────────────────────────────────────────
  const bdOffice = await prisma.office.upsert({
    where: { code: 'BD' },
    update: {},
    create: {
      code: 'BD',
      name: 'PEN Global Bangladesh',
      country: 'Bangladesh',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      taxRegime: 'BD_INCOME_TAX',
    },
  })

  const ukOffice = await prisma.office.upsert({
    where: { code: 'UK' },
    update: {},
    create: {
      code: 'UK',
      name: 'PEN Global UK',
      country: 'United Kingdom',
      currency: 'GBP',
      timezone: 'Europe/London',
      taxRegime: 'UK_PAYE',
    },
  })

  console.log('✓ Offices seeded')

  // ─── Job Grades (BD) ─────────────────────────────────────────────────────
  const bdGrades = [
    { name: 'L1 - Junior', band: 'IC', level: 1 },
    { name: 'L2 - Mid', band: 'IC', level: 2 },
    { name: 'L3 - Senior', band: 'IC', level: 3 },
    { name: 'L4 - Lead', band: 'IC', level: 4 },
    { name: 'L5 - Principal', band: 'Management', level: 5 },
    { name: 'L6 - Director', band: 'Management', level: 6 },
  ]

  for (const grade of bdGrades) {
    await prisma.jobGrade.upsert({
      where: { officeId_level: { officeId: bdOffice.id, level: grade.level } },
      update: {},
      create: { ...grade, officeId: bdOffice.id },
    })
  }

  for (const grade of bdGrades) {
    await prisma.jobGrade.upsert({
      where: { officeId_level: { officeId: ukOffice.id, level: grade.level } },
      update: {},
      create: { ...grade, officeId: ukOffice.id },
    })
  }

  console.log('✓ Job grades seeded')

  // ─── Departments (BD) ────────────────────────────────────────────────────
  const depts = [
    { name: 'Engineering', code: 'BD-ENG' },
    { name: 'Human Resources', code: 'BD-HR' },
    { name: 'Finance', code: 'BD-FIN' },
    { name: 'Operations', code: 'BD-OPS' },
  ]

  const createdDepts: Record<string, string> = {}
  for (const dept of depts) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: { ...dept, officeId: bdOffice.id },
    })
    createdDepts[dept.code] = d.id
  }

  const ukDepts = [
    { name: 'Engineering', code: 'UK-ENG' },
    { name: 'Human Resources', code: 'UK-HR' },
  ]

  for (const dept of ukDepts) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: { ...dept, officeId: ukOffice.id },
    })
    createdDepts[dept.code] = d.id
  }

  console.log('✓ Departments seeded')

  // ─── Leave Types (BD) ────────────────────────────────────────────────────
  const bdLeaveTypes = [
    {
      code: 'AL',
      name: 'Annual Leave',
      daysPerYear: 18,
      isPaid: true,
      isCarryForward: true,
      maxCarryForward: 10,
      approvalChain: [{ level: 1, role: 'TEAM_LEAD' }, { level: 2, role: 'HR_MANAGER' }],
    },
    {
      code: 'SL',
      name: 'Sick Leave',
      daysPerYear: 14,
      isPaid: true,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'HR_MANAGER' }],
    },
    {
      code: 'CL',
      name: 'Casual Leave',
      daysPerYear: 10,
      isPaid: true,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'TEAM_LEAD' }],
    },
    {
      code: 'ML',
      name: 'Maternity Leave',
      daysPerYear: 112,
      isPaid: true,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'HR_MANAGER' }],
    },
    {
      code: 'UL',
      name: 'Unpaid Leave',
      daysPerYear: 30,
      isPaid: false,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'HR_MANAGER' }],
    },
  ]

  for (const lt of bdLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { officeId_code: { officeId: bdOffice.id, code: lt.code } },
      update: {},
      create: { ...lt, officeId: bdOffice.id },
    })
  }

  const ukLeaveTypes = [
    {
      code: 'AL',
      name: 'Annual Leave',
      daysPerYear: 28,
      isPaid: true,
      isCarryForward: true,
      maxCarryForward: 10,
      approvalChain: [{ level: 1, role: 'TEAM_LEAD' }, { level: 2, role: 'HR_MANAGER' }],
    },
    {
      code: 'SL',
      name: 'Sick Leave',
      daysPerYear: 10,
      isPaid: true,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'HR_MANAGER' }],
    },
    {
      code: 'ML',
      name: 'Maternity Leave',
      daysPerYear: 260,
      isPaid: true,
      isCarryForward: false,
      approvalChain: [{ level: 1, role: 'HR_MANAGER' }],
    },
  ]

  for (const lt of ukLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { officeId_code: { officeId: ukOffice.id, code: lt.code } },
      update: {},
      create: { ...lt, officeId: ukOffice.id },
    })
  }

  console.log('✓ Leave types seeded')

  // ─── Public Holidays 2025 (BD) ───────────────────────────────────────────
  const bdHolidays2025 = [
    { name: 'New Year\'s Day', date: '2025-01-01' },
    { name: 'International Mother Language Day', date: '2025-02-21' },
    { name: 'Independence Day', date: '2025-03-26' },
    { name: 'Bengali New Year (Pohela Boishakh)', date: '2025-04-14' },
    { name: 'Eid ul-Fitr (Day 1)', date: '2025-03-31' },
    { name: 'Eid ul-Fitr (Day 2)', date: '2025-04-01' },
    { name: 'Eid ul-Adha (Day 1)', date: '2025-06-07' },
    { name: 'Eid ul-Adha (Day 2)', date: '2025-06-08' },
    { name: 'National Mourning Day', date: '2025-08-15' },
    { name: 'Victory Day', date: '2025-12-16' },
  ]

  for (const h of bdHolidays2025) {
    await prisma.publicHoliday.upsert({
      where: { officeId_date: { officeId: bdOffice.id, date: new Date(h.date) } },
      update: {},
      create: { name: h.name, date: new Date(h.date), year: 2025, officeId: bdOffice.id },
    })
  }

  const ukHolidays2025 = [
    { name: 'New Year\'s Day', date: '2025-01-01' },
    { name: 'Good Friday', date: '2025-04-18' },
    { name: 'Easter Monday', date: '2025-04-21' },
    { name: 'Early May Bank Holiday', date: '2025-05-05' },
    { name: 'Spring Bank Holiday', date: '2025-05-26' },
    { name: 'Summer Bank Holiday', date: '2025-08-25' },
    { name: 'Christmas Day', date: '2025-12-25' },
    { name: 'Boxing Day', date: '2025-12-26' },
  ]

  for (const h of ukHolidays2025) {
    await prisma.publicHoliday.upsert({
      where: { officeId_date: { officeId: ukOffice.id, date: new Date(h.date) } },
      update: {},
      create: { name: h.name, date: new Date(h.date), year: 2025, officeId: ukOffice.id },
    })
  }

  console.log('✓ Public holidays seeded')

  // ─── Super Admin Employee + User ─────────────────────────────────────────
  const hrDeptId = createdDepts['BD-HR']

  const adminEmployee = await prisma.employee.upsert({
    where: { employeeId: 'BD-2024-001' },
    update: {},
    create: {
      employeeId: 'BD-2024-001',
      officeId: bdOffice.id,
      departmentId: hrDeptId,
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@company.com',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      joiningDate: new Date('2024-01-01'),
    },
  })

  await prisma.user.upsert({
    where: { employeeId: adminEmployee.id },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      email: 'admin@company.com',
      passwordHash: hashPassword('Admin@123'),
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  console.log('✓ Super admin seeded (email: admin@company.com, password: Admin@123)')
  console.log('\n⚠️  Change the admin password immediately after first login!')
  console.log('\nDone! Database is ready.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
