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
      approvalChain: [
        { level: 1, role: 'TEAM_LEAD' },
        { level: 2, role: 'HR_MANAGER' },
      ],
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
      approvalChain: [
        { level: 1, role: 'TEAM_LEAD' },
        { level: 2, role: 'HR_MANAGER' },
      ],
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

  // ─── Public Holidays 2026 ─────────────────────────────────────────────────
  // Clear stale 2026 records before reinserting with correct dates
  await prisma.publicHoliday.deleteMany({ where: { officeId: bdOffice.id, year: 2026 } })
  await prisma.publicHoliday.deleteMany({ where: { officeId: ukOffice.id, year: 2026 } })

  const bdHolidays2026 = [
    { name: 'Shab-e-Barat',                     date: '2026-02-04' },
    { name: 'International Mother Language Day', date: '2026-02-21' },
    { name: 'Shab-e-Qadar',                      date: '2026-03-17' },
    { name: 'Eid-Ul-Fitr (Day 1)',               date: '2026-03-20' },
    { name: 'Eid-Ul-Fitr (Day 2)',               date: '2026-03-21' },
    { name: 'Eid-Ul-Fitr (Day 3)',               date: '2026-03-22' },
    { name: 'Eid-Ul-Fitr (Day 4)',               date: '2026-03-23' },
    { name: 'Independence Day',                  date: '2026-03-26' },
    { name: 'Bengali New Year',                  date: '2026-04-14' },
    { name: 'May Day / Buddha Purnima',          date: '2026-05-01' },
    { name: 'Eid-Ul-Adha (Day 1)',               date: '2026-05-27' },
    { name: 'Eid-Ul-Adha (Day 2)',               date: '2026-05-28' },
    { name: 'Eid-Ul-Adha (Day 3)',               date: '2026-05-29' },
    { name: 'Eid-Ul-Adha (Day 4)',               date: '2026-05-30' },
    { name: 'July Mass Uprising Day',            date: '2026-08-05' },
    { name: 'Eid-e-Miladunnabi',                 date: '2026-08-26' },
    { name: 'Durga Puja (Day 1)',                date: '2026-10-20' },
    { name: 'Durga Puja (Day 2)',                date: '2026-10-21' },
    { name: 'Victory Day',                       date: '2026-12-16' },
  ]

  await prisma.publicHoliday.createMany({
    data: bdHolidays2026.map(h => ({
      name: h.name,
      date: new Date(h.date),
      year: 2026,
      officeId: bdOffice.id,
      isRecurring: false,
    })),
  })

  const ukHolidays2026 = [
    { name: "New Year's Day",        date: '2026-01-01' },
    { name: 'Good Friday',           date: '2026-04-03' },
    { name: 'Easter Monday',         date: '2026-04-06' },
    { name: 'Early May Bank Holiday',date: '2026-05-04' },
    { name: 'Spring Bank Holiday',   date: '2026-05-25' },
    { name: 'Summer Bank Holiday',   date: '2026-08-31' },
    { name: 'Christmas Day',         date: '2026-12-25' },
    { name: 'Boxing Day',            date: '2026-12-28' },
    { name: 'Christmas Break (Day 1)',date: '2026-12-29' },
    { name: 'Christmas Break (Day 2)',date: '2026-12-30' },
    { name: 'Christmas Break (Day 3)',date: '2026-12-31' },
  ]

  await prisma.publicHoliday.createMany({
    data: ukHolidays2026.map(h => ({
      name: h.name,
      date: new Date(h.date),
      year: 2026,
      officeId: ukOffice.id,
      isRecurring: false,
    })),
  })

  console.log('✓ Public holidays 2026 seeded (BD: 19, UK: 11)')

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

  // ─── Job-grade salary structures ─────────────────────────────────────────
  // These are defaults: any employee assigned to a grade inherits these
  // amounts unless they have an employee-specific structure.
  const bdGradeSalaries = [
    { level: 1, basicSalary: 25000 },   // L1 Junior
    { level: 2, basicSalary: 40000 },   // L2 Mid
    { level: 3, basicSalary: 60000 },   // L3 Senior
    { level: 4, basicSalary: 85000 },   // L4 Lead
    { level: 5, basicSalary: 120000 },  // L5 Principal
    { level: 6, basicSalary: 180000 },  // L6 Director
  ]

  // BD allowances: 40% house rent + 10% medical on basic
  const bdComponents = [
    { name: 'House Rent Allowance', type: 'ALLOWANCE', amount: 40, isPercentage: true },
    { name: 'Medical Allowance', type: 'ALLOWANCE', amount: 10, isPercentage: true },
  ]

  for (const { level, basicSalary } of bdGradeSalaries) {
    const grade = await prisma.jobGrade.findFirst({ where: { officeId: bdOffice.id, level } })
    if (!grade) continue
    const existing = await prisma.salaryStructure.findFirst({ where: { jobGradeId: grade.id, employeeId: null } })
    if (!existing) {
      await prisma.salaryStructure.create({
        data: {
          jobGradeId: grade.id,
          basicSalary,
          currency: 'BDT',
          components: bdComponents,
          effectiveFrom: new Date('2024-01-01'),
        },
      })
    }
  }

  const ukGradeSalaries = [
    { level: 1, basicSalary: 2500 },
    { level: 2, basicSalary: 3500 },
    { level: 3, basicSalary: 5000 },
    { level: 4, basicSalary: 7000 },
    { level: 5, basicSalary: 9000 },
    { level: 6, basicSalary: 12000 },
  ]

  // UK allowances: 5% London allowance on basic
  const ukComponents = [
    { name: 'London Allowance', type: 'ALLOWANCE', amount: 5, isPercentage: true },
  ]

  for (const { level, basicSalary } of ukGradeSalaries) {
    const grade = await prisma.jobGrade.findFirst({ where: { officeId: ukOffice.id, level } })
    if (!grade) continue
    const existing = await prisma.salaryStructure.findFirst({ where: { jobGradeId: grade.id, employeeId: null } })
    if (!existing) {
      await prisma.salaryStructure.create({
        data: {
          jobGradeId: grade.id,
          basicSalary,
          currency: 'GBP',
          components: ukComponents,
          effectiveFrom: new Date('2024-01-01'),
        },
      })
    }
  }

  console.log('✓ Job-grade salary structures seeded (BD + UK, all 6 levels)')
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
