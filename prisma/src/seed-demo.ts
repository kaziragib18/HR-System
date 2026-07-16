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
  // ── Accounts ── DEPT_HEAD: nadia · DEPT_MANAGER: hassan, arif ──────────────
  { key: 'nadia',  firstName: 'Nadia',   lastName: 'Islam',     deptCode: 'ACC', jobTitleName: 'Director of Finance and Accounts', gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-01-10', password: 'Password@123' },
  { key: 'hassan', firstName: 'Hassan',  lastName: 'Mahmud',    deptCode: 'ACC', jobTitleName: 'Assistant Accounts Manager',       gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-05-01', password: 'Password@123', managerKey: 'nadia' },
  { key: 'arif',   firstName: 'Arif',    lastName: 'Rahman',    deptCode: 'ACC', jobTitleName: 'Accounts Team Leader',             gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-06-01', password: 'Employee@123', managerKey: 'nadia' },
  { key: 'mita',   firstName: 'Mita',    lastName: 'Roy',       deptCode: 'ACC', jobTitleName: 'Accounts Assistant',               gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-03-15', password: 'Password@123', managerKey: 'hassan' },
  { key: 'farida', firstName: 'Farida',  lastName: 'Yasmin',    deptCode: 'ACC', jobTitleName: 'Senior Accounts Officer',          gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-09-01', password: 'Password@123', managerKey: 'hassan' },
  { key: 'liton',  firstName: 'Liton',   lastName: 'Barua',     deptCode: 'ACC', jobTitleName: 'Accounts Officer',                 gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-02-01', password: 'Password@123', managerKey: 'hassan' },
  { key: 'joya',   firstName: 'Joya',    lastName: 'Chowdhury', deptCode: 'ACC', jobTitleName: 'Junior Accountant',                gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-10-01', password: 'Password@123', managerKey: 'arif' },
  { key: 'rumana', firstName: 'Rumana',  lastName: 'Parvin',    deptCode: 'ACC', jobTitleName: 'Billing Coordinator',              gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-05-15', password: 'Password@123', managerKey: 'arif' },
  { key: 'shafiq', firstName: 'Shafiq',  lastName: 'Alam',      deptCode: 'ACC', jobTitleName: 'Accounts Executive',               gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'arif' },
  { key: 'dolon',  firstName: 'Dolon',   lastName: 'Saha',      deptCode: 'ACC', jobTitleName: 'Internal Auditor',                 gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-12-01', password: 'Password@123', managerKey: 'nadia' },

  // ── Admissions ── DEPT_HEAD: jawad · DEPT_MANAGER: kabir ───────────────────
  { key: 'jawad',    firstName: 'Jawad',    lastName: 'Uddin',    deptCode: 'ADM', jobTitleName: 'Director of Operations and Business Development', gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-02-01', password: 'Password@123' },
  { key: 'kabir',    firstName: 'Kabir',    lastName: 'Hossain',  deptCode: 'ADM', jobTitleName: 'Senior Admissions Officer',                        gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-08-01', password: 'Password@123', managerKey: 'jawad' },
  { key: 'sadia',    firstName: 'Sadia',    lastName: 'Akter',    deptCode: 'ADM', jobTitleName: 'Admissions Officer & Interviewer',                 gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-01-08', password: 'Password@123', managerKey: 'kabir' },
  { key: 'puja',     firstName: 'Puja',     lastName: 'Sen',      deptCode: 'ADM', jobTitleName: 'Admissions Coordinator',                           gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-06-10', password: 'Password@123', managerKey: 'kabir' },
  { key: 'rafsan',   firstName: 'Rafsan',   lastName: 'Kader',    deptCode: 'ADM', jobTitleName: 'Admissions Officer',                               gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-04-01', password: 'Password@123', managerKey: 'kabir' },
  { key: 'moushumi', firstName: 'Moushumi', lastName: 'Rahman',   deptCode: 'ADM', jobTitleName: 'Admissions Assistant',                             gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-09-01', password: 'Password@123', managerKey: 'kabir' },
  { key: 'tania',    firstName: 'Tania',    lastName: 'Ferdous',  deptCode: 'ADM', jobTitleName: 'Enrollment Coordinator',                           gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-07-01', password: 'Password@123', managerKey: 'kabir' },
  { key: 'iqbal',    firstName: 'Iqbal',    lastName: 'Hasan',    deptCode: 'ADM', jobTitleName: 'Admissions Executive',                             gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-03-01', password: 'Password@123', managerKey: 'kabir' },
  { key: 'nayeem',   firstName: 'Nayeem',   lastName: 'Khan',     deptCode: 'ADM', jobTitleName: 'Student Counselor',                                gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-11-01', password: 'Password@123', managerKey: 'kabir' },
  { key: 'farhana',  firstName: 'Farhana', lastName: 'Islam',     deptCode: 'ADM', jobTitleName: 'Admissions Officer',                               gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-10-15', password: 'Password@123', managerKey: 'jawad' },

  // ── Finance ── DEPT_HEAD: imran · DEPT_MANAGER: shirin ─────────────────────
  { key: 'imran',  firstName: 'Imran',  lastName: 'Khan',      deptCode: 'FIN', jobTitleName: 'Lead Payments Officer',    gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-01-15', password: 'Password@123' },
  { key: 'shirin', firstName: 'Shirin', lastName: 'Nahar',     deptCode: 'FIN', jobTitleName: 'Finance Manager',          gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-11-01', password: 'Password@123', managerKey: 'imran' },
  { key: 'fatema', firstName: 'Fatema', lastName: 'Begum',     deptCode: 'FIN', jobTitleName: 'Payments Officer',        gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-02-14', password: 'Password@123', managerKey: 'shirin' },
  { key: 'babul',  firstName: 'Babul',  lastName: 'Sarker',    deptCode: 'FIN', jobTitleName: 'Senior Payments Officer', gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-09-01', password: 'Password@123', managerKey: 'shirin' },
  { key: 'nasrin', firstName: 'Nasrin', lastName: 'Jahan',     deptCode: 'FIN', jobTitleName: 'Finance Executive',       gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-05-01', password: 'Password@123', managerKey: 'shirin' },
  { key: 'kamal',  firstName: 'Kamal',  lastName: 'Uddin',     deptCode: 'FIN', jobTitleName: 'Billing Officer',         gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-06-01', password: 'Password@123', managerKey: 'shirin' },
  { key: 'shila',  firstName: 'Shila',  lastName: 'Akhter',    deptCode: 'FIN', jobTitleName: 'Accounts Payable Officer', gradeLevel: 2, role: 'EMPLOYEE',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-07-15', password: 'Password@123', managerKey: 'shirin' },
  { key: 'forhad', firstName: 'Forhad', lastName: 'Molla',     deptCode: 'FIN', jobTitleName: 'Treasury Officer',        gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-12-01', password: 'Password@123', managerKey: 'shirin' },
  { key: 'ruma',   firstName: 'Ruma',   lastName: 'Khatun',    deptCode: 'FIN', jobTitleName: 'Finance Assistant',       gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-10-01', password: 'Password@123', managerKey: 'shirin' },
  { key: 'opu',    firstName: 'Opu',    lastName: 'Talukder',  deptCode: 'FIN', jobTitleName: 'Payments Officer',        gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-08-15', password: 'Password@123', managerKey: 'imran' },

  // ── Human Resources ── HR_MANAGER: sarah · DEPT_HEAD: farzana · DEPT_MANAGER: riya
  { key: 'sarah',   firstName: 'Sarah',   lastName: 'Ahmed',    deptCode: 'HR', jobTitleName: 'Director of People Experience', gradeLevel: 6, role: 'HR_MANAGER',   type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-03-01', password: 'Manager@123' },
  { key: 'farzana', firstName: 'Farzana', lastName: 'Karim',    deptCode: 'HR', jobTitleName: 'HR Director',                   gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-04-01', password: 'Password@123' },
  { key: 'riya',    firstName: 'Riya',    lastName: 'Sultana',  deptCode: 'HR', jobTitleName: 'HR Assistant Manager',          gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-11-01', password: 'Password@123', managerKey: 'farzana' },
  { key: 'rina',    firstName: 'Rina',    lastName: 'Das',      deptCode: 'HR', jobTitleName: 'HR Assistant',                  gradeLevel: 2, role: 'EMPLOYEE',     type: 'PART_TIME', status: 'ACTIVE',    joiningDate: '2024-09-15', password: 'Password@123', managerKey: 'riya' },
  { key: 'mahin',   firstName: 'Mahin',   lastName: 'Reza',     deptCode: 'HR', jobTitleName: 'HR Officer',                    gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-04-01', password: 'Password@123', managerKey: 'riya' },
  { key: 'shampa',  firstName: 'Shampa',  lastName: 'Biswas',   deptCode: 'HR', jobTitleName: 'Recruitment Officer',           gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-06-15', password: 'Password@123', managerKey: 'riya' },
  { key: 'zubair',  firstName: 'Zubair',  lastName: 'Hossain',  deptCode: 'HR', jobTitleName: 'HR Executive',                  gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'riya' },
  { key: 'nasima',  firstName: 'Nasima',  lastName: 'Begum',    deptCode: 'HR', jobTitleName: 'Payroll Coordinator',           gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-12-15', password: 'Password@123', managerKey: 'riya' },
  { key: 'kamrul',  firstName: 'Kamrul',  lastName: 'Islam',    deptCode: 'HR', jobTitleName: 'Training Officer',              gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-05-01', password: 'Password@123', managerKey: 'riya' },
  { key: 'labonno', firstName: 'Labonno', lastName: 'Akter',    deptCode: 'HR', jobTitleName: 'HR Officer',                    gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-11-01', password: 'Password@123', managerKey: 'farzana' },

  // ── Information Technology ── DEPT_HEAD: tanvir · DEPT_MANAGER: salam ──────
  { key: 'tanvir',  firstName: 'Tanvir',  lastName: 'Islam',     deptCode: 'IT', jobTitleName: 'Director of IT',        gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-04-01', password: 'Password@123' },
  { key: 'salam',   firstName: 'Salam',   lastName: 'Chowdhury', deptCode: 'IT', jobTitleName: 'IT Manager',            gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-09-01', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'mehedi',  firstName: 'Mehedi',  lastName: 'Hasan',     deptCode: 'IT', jobTitleName: 'System Administrator',  gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-01-20', password: 'Password@123', managerKey: 'salam' },
  { key: 'kajal',   firstName: 'Kajal',   lastName: 'Debnath',   deptCode: 'IT', jobTitleName: 'IT Support Officer',    gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-03-01', password: 'Password@123', managerKey: 'salam' },
  { key: 'shanto',  firstName: 'Shanto',  lastName: 'Bepari',    deptCode: 'IT', jobTitleName: 'Network Engineer',      gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-10-15', password: 'Password@123', managerKey: 'salam' },
  { key: 'himel',   firstName: 'Himel',   lastName: 'Sikder',    deptCode: 'IT', jobTitleName: 'IT Coordinator',        gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-06-01', password: 'Password@123', managerKey: 'salam' },
  { key: 'proma',   firstName: 'Proma',   lastName: 'Dutta',     deptCode: 'IT', jobTitleName: 'Systems Analyst',       gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-02-01', password: 'Password@123', managerKey: 'salam' },
  { key: 'eshan',   firstName: 'Eshan',   lastName: 'Mridha',    deptCode: 'IT', jobTitleName: 'IT Officer',            gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-07-01', password: 'Password@123', managerKey: 'salam' },
  { key: 'nabila',  firstName: 'Nabila',  lastName: 'Yeasmin',   deptCode: 'IT', jobTitleName: 'Helpdesk Executive',    gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-09-01', password: 'Password@123', managerKey: 'salam' },
  { key: 'rehnuma', firstName: 'Rehnuma', lastName: 'Afrin',     deptCode: 'IT', jobTitleName: 'IT Support Officer',    gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-11-15', password: 'Password@123', managerKey: 'tanvir' },

  // ── IT (Software Development) ── DEPT_HEAD: karim · DEPT_MANAGER: farabi ───
  { key: 'karim',     firstName: 'Karim',     lastName: 'Hossain',  deptCode: 'IT-SW', jobTitleName: 'Software Engineering Manager', gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-06-01', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'farabi',    firstName: 'Farabi',    lastName: 'Anwar',    deptCode: 'IT-SW', jobTitleName: 'Engineering Team Lead',        gradeLevel: 5, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-10-01', password: 'Password@123', managerKey: 'karim' },
  { key: 'rakib',     firstName: 'Rakib',     lastName: 'Hasan',    deptCode: 'IT-SW', jobTitleName: 'Senior PHP Developer',         gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'PROBATION', joiningDate: '2026-05-01', password: 'Password@123', managerKey: 'farabi' },
  { key: 'nusrat',    firstName: 'Nusrat',    lastName: 'Jahan',    deptCode: 'IT-SW', jobTitleName: 'React Developer',              gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-05-20', password: 'Password@123', managerKey: 'farabi' },
  { key: 'tashfia',   firstName: 'Tashfia',   lastName: 'Noor',     deptCode: 'IT-SW', jobTitleName: 'QA Engineer',                  gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-06-01', password: 'Password@123', managerKey: 'farabi' },
  { key: 'bijoy',     firstName: 'Bijoy',     lastName: 'Halder',   deptCode: 'IT-SW', jobTitleName: 'Junior Developer',             gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'farabi' },
  { key: 'mizan',     firstName: 'Mizan',     lastName: 'Sheikh',   deptCode: 'IT-SW', jobTitleName: 'DevOps Engineer',              gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-01-15', password: 'Password@123', managerKey: 'farabi' },
  { key: 'ovi',       firstName: 'Ovi',       lastName: 'Chakma',   deptCode: 'IT-SW', jobTitleName: 'Frontend Developer',           gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-04-15', password: 'Password@123', managerKey: 'farabi' },
  { key: 'shanchita', firstName: 'Shanchita', lastName: 'Mondol',   deptCode: 'IT-SW', jobTitleName: 'Senior PHP Developer',         gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-12-01', password: 'Password@123', managerKey: 'farabi' },
  { key: 'fahim',     firstName: 'Fahim',     lastName: 'Rashid',   deptCode: 'IT-SW', jobTitleName: 'Junior Developer',             gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-10-15', password: 'Password@123', managerKey: 'karim' },

  // ── IT (Tech Support) ── DEPT_HEAD: masum · DEPT_MANAGER: yeasin ───────────
  { key: 'masum',  firstName: 'Masum',  lastName: 'Hossain',  deptCode: 'IT-TS', jobTitleName: 'Project Manager',           gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-07-15', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'yeasin', firstName: 'Yeasin', lastName: 'Arafat',   deptCode: 'IT-TS', jobTitleName: 'Support Team Lead',         gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-11-15', password: 'Password@123', managerKey: 'masum' },
  { key: 'shahed', firstName: 'Shahed', lastName: 'Ali',      deptCode: 'IT-TS', jobTitleName: 'Infrastructure Technician', gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-10-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'rubel',  firstName: 'Rubel',  lastName: 'Mia',      deptCode: 'IT-TS', jobTitleName: 'Cloud Engineer',            gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-03-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'shuvo',  firstName: 'Shuvo',  lastName: 'Roy',      deptCode: 'IT-TS', jobTitleName: 'IT Technician',             gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'PROBATION', joiningDate: '2026-06-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'sagor',  firstName: 'Sagor',  lastName: 'Miah',     deptCode: 'IT-TS', jobTitleName: 'Tech Support',              gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-08-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'rafi',   firstName: 'Rafi',   lastName: 'Islam',    deptCode: 'IT-TS', jobTitleName: 'Tech Support Specialist',   gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-11-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'milon',  firstName: 'Milon',  lastName: 'Prodhan',  deptCode: 'IT-TS', jobTitleName: 'IT Technician',             gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-05-01', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'poly',   firstName: 'Poly',   lastName: 'Dey',      deptCode: 'IT-TS', jobTitleName: 'Tech Support',              gradeLevel: 1, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2024-09-15', password: 'Password@123', managerKey: 'yeasin' },
  { key: 'zahid',  firstName: 'Zahid',  lastName: 'Kabir',    deptCode: 'IT-TS', jobTitleName: 'Cloud Engineer',            gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE',    joiningDate: '2023-09-15', password: 'Password@123', managerKey: 'masum' },

  // ── IT (Web Development) ── DEPT_HEAD: habib · DEPT_MANAGER: tasnim ────────
  { key: 'habib',   firstName: 'Habib',   lastName: 'Ullah',   deptCode: 'IT-WD', jobTitleName: 'Line Manager',          gradeLevel: 6, role: 'DEPT_HEAD',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-05-15', password: 'Password@123', managerKey: 'tanvir' },
  { key: 'tasnim',  firstName: 'Tasnim',  lastName: 'Rahman',  deptCode: 'IT-WD', jobTitleName: 'Web Team Lead',         gradeLevel: 4, role: 'DEPT_MANAGER', type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-10-15', password: 'Password@123', managerKey: 'habib' },
  { key: 'rajib',   firstName: 'Rajib',   lastName: 'Ahmed',   deptCode: 'IT-WD', jobTitleName: 'Web Developer',         gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-04-01', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'priya',   firstName: 'Priya',   lastName: 'Sharma',  deptCode: 'IT-WD', jobTitleName: 'UI/UX Designer',        gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-07-10', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'shovon',  firstName: 'Shovon',  lastName: 'Datta',   deptCode: 'IT-WD', jobTitleName: 'Backend Developer',     gradeLevel: 3, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-02-15', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'mitu',    firstName: 'Mitu',    lastName: 'Akhter',  deptCode: 'IT-WD', jobTitleName: 'QA Tester',             gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-06-15', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'rumi',    firstName: 'Rumi',    lastName: 'Nasrin',  deptCode: 'IT-WD', jobTitleName: 'Web Content Specialist', gradeLevel: 2, role: 'EMPLOYEE',    type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-09-01', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'aslam',   firstName: 'Aslam',   lastName: 'Bhuiyan', deptCode: 'IT-WD', jobTitleName: 'Web Developer',         gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-05-15', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'chumki',  firstName: 'Chumki',  lastName: 'Paul',    deptCode: 'IT-WD', jobTitleName: 'Backend Developer',     gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2024-08-15', password: 'Password@123', managerKey: 'tasnim' },
  { key: 'tuhin',   firstName: 'Tuhin',   lastName: 'Ghosh',   deptCode: 'IT-WD', jobTitleName: 'UI/UX Designer',        gradeLevel: 2, role: 'EMPLOYEE',     type: 'FULL_TIME', status: 'ACTIVE', joiningDate: '2023-11-01', password: 'Password@123', managerKey: 'habib' },
]

function empEmail(e: DemoEmployee) {
  return `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}${DEMO_DOMAIN}`
}

function atTime(day: Date, h: number, m: number) {
  // Check-in/check-out are office-local wall-clock digits stored in a Date's
  // UTC slots throughout this app (see dateToMinutes in
  // packages/utils/src/attendance.ts) — setUTCHours, not setHours, or the
  // seeded times drift by the seeding machine's own local timezone offset.
  const d = new Date(day)
  d.setUTCHours(h, m, 0, 0)
  return d
}

function dateOnly(day: Date) {
  // UTC, not local — Postgres receives this Date as a UTC ISO string for the
  // @db.Date `date` column, so local midnight on a positive-UTC-offset
  // machine (BST, BD) serializes as the *previous* day's late evening UTC,
  // silently storing every seeded attendance row one calendar day early.
  const d = new Date(day)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
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
  await prisma.payrollEntry.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.notification.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.onboardingTask.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.bankInfo.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.document.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.workExperience.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.education.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.employeeSkill.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.certification.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.identification.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.salaryStructure.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.announcement.deleteMany({ where: { authorId: { in: ids } } })
  await prisma.complianceDoc.deleteMany({ where: { uploadedById: { in: ids } } })
  await prisma.department.updateMany({ where: { managerId: { in: ids } }, data: { managerId: null } })
  const demoUsers = await prisma.user.findMany({ where: { employeeId: { in: ids } }, select: { id: true } })
  await prisma.auditLog.deleteMany({ where: { userId: { in: demoUsers.map((u) => u.id) } } })
  await prisma.user.deleteMany({ where: { employeeId: { in: ids } } })
  await prisma.employee.updateMany({ where: { id: { in: ids } }, data: { reportingToId: null } })
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

  // ── Validate roster against seeded departments/job titles up front ───────
  // Fail loudly before creating anything — a typo here would otherwise leave
  // a silently under-titled employee (or a partial run) instead of a clear error.
  const missing: string[] = []
  for (const e of EMPLOYEES) {
    const dept = deptByCode[e.deptCode]
    if (!dept) { missing.push(`${e.key}: department "${e.deptCode}" does not exist`); continue }
    if (!allTitles.some((t) => t.departmentId === dept.id && t.name === e.jobTitleName)) {
      missing.push(`${e.key}: job title "${e.jobTitleName}" does not exist in ${e.deptCode}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Seed roster references unknown departments/job titles:\n  ${missing.join('\n  ')}`)
  }

  // ── Create employees + users ─────────────────────────────────────────────
  const idByKey: Record<string, string> = {}
  for (const e of EMPLOYEES) {
    const dept = deptByCode[e.deptCode]!
    const grade = grades.find((g) => g.officeId === bdOffice.id && g.level === e.gradeLevel)
    const title = allTitles.find((t) => t.departmentId === dept.id && t.name === e.jobTitleName)

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

  // Department managers — derived from the roster's DEPT_HEAD, not hardcoded.
  // Every department THIS ROSTER POPULATES must end up with exactly one: this
  // is the same invariant updateEmployeeRole enforces at runtime (see
  // employees.service.ts), so the seed data must never violate it either.
  // Scoped to the departments actually referenced by EMPLOYEES — the office
  // may also contain unrelated legacy departments (e.g. leftover "ENG"/"MKT"/
  // "OM" rows this demo roster never touches) that shouldn't be forced to
  // have a head just because this script ran.
  const rosterDeptCodes = [...new Set(EMPLOYEES.map((e) => e.deptCode))]
  const deptHeadsByDept: Record<string, string[]> = {}
  for (const e of EMPLOYEES) {
    if (e.role !== 'DEPT_HEAD' || !idByKey[e.key]) continue
    ;(deptHeadsByDept[e.deptCode] ??= []).push(e.key)
  }
  for (const deptCode of rosterDeptCodes) {
    const heads = deptHeadsByDept[deptCode] ?? []
    if (heads.length !== 1) {
      throw new Error(`Department "${deptCode}" must have exactly one DEPT_HEAD, found ${heads.length} (${heads.join(', ') || 'none'})`)
    }
    await prisma.department.update({ where: { code: deptCode }, data: { managerId: idByKey[heads[0]] } })
  }
  console.log('✓ Reporting lines + department managers set')

  // ── Leave balances (current year) ────────────────────────────────────────
  const year = new Date().getFullYear()
  // Compensatory Leave (CPL) is intentionally excluded here: it must only appear
  // in an employee's balance once they actually take it (lazily created on first
  // application in leave.service.ts), so no CPL balance row is pre-seeded.
  const bdLeaveTypes = leaveTypes.filter((lt) => lt.officeId === bdOffice.id && lt.code !== 'CPL')
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

  // Two employees on leave today. karim is IT-SW's DEPT_HEAD, so his own leave
  // escalates to the HR department's DEPT_HEAD (farzana), not HR_MANAGER —
  // matches resolveTeamApprover's DEPT_HEAD/HR_MANAGER branch. nusrat is a
  // plain EMPLOYEE reporting to farabi (her DEPT_MANAGER).
  await prisma.leaveApplication.create({
    data: {
      employeeId:       idByKey['karim'],
      leaveTypeId:      bdLeave('AL').id,
      startDate:        addDays(today, -1),
      endDate:          addDays(today, 1),
      totalDays:        3,
      reason:           'Family event',
      status:           'APPROVED',
      approvedById:     idByKey['farzana'],
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
      approvedById:     idByKey['farabi'],
      approvedAt:       today,
    },
  })

  // Pending leaves for approval queue — each routed to the requester's real
  // DEPT_MANAGER, matching resolveTeamApprover's reporting-chain resolution.
  const pending: Array<[string, string, number, number, string, string]> = [
    ['fatema', 'AL',  5,  7, 'Annual vacation',  'shirin'],
    ['sadia',  'CL', 10, 10, 'Personal errand',  'kabir'],
    ['rina',   'AL',  8,  9, 'Travel',           'riya'],
    ['rajib',  'CL',  3,  4, 'Personal work',    'tasnim'],
  ]
  for (const [key, code, startOff, endOff, reason, approverKey] of pending) {
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
        currentApproverId:  idByKey[approverKey],
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
      const dow        = day.getUTCDay()
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

  // [key, basicSalary BDT/month, presentDays, leaveDays] — basic mirrors the
  // employee's gradeLevel via seed.ts's bdGradeSalaries (g6=180000 ... g1=25000).
  const BD_PAY: Array<[string, number, number, number]> = [
    // Accounts
    ['nadia', 180000, 22, 0], ['hassan', 85000, 22, 0], ['arif', 85000, 21, 0], ['mita', 40000, 22, 0],
    ['farida', 60000, 22, 0], ['liton', 40000, 22, 0], ['joya', 25000, 22, 0], ['rumana', 40000, 22, 0],
    ['shafiq', 40000, 22, 0], ['dolon', 60000, 22, 0],
    // Admissions
    ['jawad', 180000, 21, 0], ['kabir', 85000, 22, 0], ['sadia', 60000, 22, 0], ['puja', 40000, 22, 0],
    ['rafsan', 40000, 22, 0], ['moushumi', 25000, 22, 0], ['tania', 40000, 22, 0], ['iqbal', 40000, 22, 0],
    ['nayeem', 40000, 22, 0], ['farhana', 40000, 22, 0],
    // Finance
    ['imran', 180000, 22, 0], ['shirin', 85000, 22, 0], ['fatema', 40000, 22, 0], ['babul', 60000, 22, 0],
    ['nasrin', 40000, 22, 0], ['kamal', 40000, 22, 0], ['shila', 40000, 22, 0], ['forhad', 60000, 22, 0],
    ['ruma', 25000, 22, 0], ['opu', 40000, 22, 0],
    // Human Resources
    ['sarah', 180000, 21, 0], ['farzana', 180000, 22, 0], ['riya', 85000, 22, 0], ['rina', 40000, 20, 0],
    ['mahin', 40000, 22, 0], ['shampa', 40000, 22, 0], ['zubair', 40000, 22, 0], ['nasima', 40000, 22, 0],
    ['kamrul', 40000, 22, 0], ['labonno', 25000, 22, 0],
    // Information Technology
    ['tanvir', 180000, 22, 0], ['salam', 85000, 22, 0], ['mehedi', 60000, 22, 0], ['kajal', 40000, 22, 0],
    ['shanto', 60000, 22, 0], ['himel', 40000, 22, 0], ['proma', 60000, 22, 0], ['eshan', 40000, 22, 0],
    ['nabila', 25000, 22, 0], ['rehnuma', 40000, 22, 0],
    // IT (Software Development)
    ['karim', 180000, 18, 2], ['farabi', 120000, 22, 0], ['rakib', 60000, 20, 0], ['nusrat', 60000, 19, 1],
    ['tashfia', 40000, 22, 0], ['bijoy', 25000, 22, 0], ['mizan', 60000, 22, 0], ['ovi', 40000, 22, 0],
    ['shanchita', 60000, 22, 0], ['fahim', 25000, 22, 0],
    // IT (Tech Support)
    ['masum', 180000, 22, 0], ['yeasin', 85000, 22, 0], ['shahed', 60000, 21, 0], ['rubel', 60000, 22, 0],
    ['shuvo', 40000, 18, 0], ['sagor', 25000, 21, 0], ['rafi', 40000, 22, 0], ['milon', 40000, 22, 0],
    ['poly', 25000, 22, 0], ['zahid', 60000, 22, 0],
    // IT (Web Development)
    ['habib', 180000, 22, 0], ['tasnim', 85000, 22, 0], ['rajib', 60000, 22, 0], ['priya', 40000, 21, 0],
    ['shovon', 60000, 22, 0], ['mitu', 40000, 22, 0], ['rumi', 40000, 22, 0], ['aslam', 40000, 22, 0],
    ['chumki', 40000, 22, 0], ['tuhin', 40000, 22, 0],
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
  console.log('  SUPER ADMIN   : admin@company.com              / Admin@123')
  console.log('  HR MANAGER    : sarah.ahmed@xyztech.com        / Manager@123   (view-only on approvals)')
  console.log('  DEPT HEAD     : farzana.karim@xyztech.com      / Password@123  (HR — approves other DEPT_HEADs\' leave)')
  console.log('  DEPT HEAD     : nadia.islam@xyztech.com        / Password@123  (Accounts)')
  console.log('  DEPT HEAD     : jawad.uddin@xyztech.com        / Password@123  (Admissions)')
  console.log('  DEPT HEAD     : imran.khan@xyztech.com         / Password@123  (Finance)')
  console.log('  DEPT HEAD     : tanvir.islam@xyztech.com       / Password@123  (IT)')
  console.log('  DEPT HEAD     : karim.hossain@xyztech.com      / Password@123  (IT-SW)')
  console.log('  DEPT HEAD     : masum.hossain@xyztech.com      / Password@123  (IT-TS)')
  console.log('  DEPT HEAD     : habib.ullah@xyztech.com        / Password@123  (IT-WD)')
  console.log('  DEPT MANAGER  : hassan.mahmud@xyztech.com      / Password@123  (Accounts)')
  console.log('  DEPT MANAGER  : arif.rahman@xyztech.com        / Employee@123  (Accounts)')
  console.log('  DEPT MANAGER  : farabi.anwar@xyztech.com       / Password@123  (IT-SW — reports to karim)')
  console.log('  EMPLOYEE      : mita.roy@xyztech.com           / Password@123  (Accounts)')
  console.log('  (all other demo staff: Password@123)')
  console.log('──────────────────────────────────────────────────────')
  console.log('Done!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
