# Role Management Scoping Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hierarchy-only RBAC checks with resource-level scoping for leave approval, attendance excuse review, and salary access, so TEAM_LEAD/DEPT_HEAD act only within their real reporting/department scope, and close two cross-office tenant-isolation leaks found while designing the fix.

**Architecture:** Resolve scope inline from existing relational fields (`Employee.reportingToId`, `Department.managerId`) via one shared resolver (`resolveApproverForRole`) reused by the leave module; attendance and salary get equivalent, module-local scoping checks. No schema changes. HR_MANAGER/SUPER_ADMIN keep their existing office-wide/global reach.

**Tech Stack:** Express + Prisma (`apps/api`), Zod validation, Vitest with mocked Prisma client + supertest for route-level regression tests (existing pattern in `apps/api/src/__tests__/tenant-isolation.test.ts`).

## Global Constraints

- TEAM_LEAD-level resolution = `Employee.reportingToId` matching the caller.
- DEPT_HEAD-level resolution = `Department.managerId` matching the caller.
- HR_MANAGER/SUPER_ADMIN-level resolution = unchanged "any user with that role in office" behavior (office-wide by design).
- "Admin" (bypasses the per-application approver-identity check) means SUPER_ADMIN or HR_MANAGER specifically — not the broader `MANAGER_ROLES` list used elsewhere in `leave.controller.ts`.
- No Prisma schema changes.
- Explicitly out of scope — do not touch: `GET /leave/balances/:employeeId`, manager-view `GET /leave/applications`.
- Every task's Prisma mock in tests must mirror the exact query shape the implementation actually calls (field names, nesting) — these are regression tests for real bugs, not smoke tests.

---

### Task 1: Shared approver resolver (`leave.service.ts`)

**Files:**
- Modify: `apps/api/src/modules/leave/leave.service.ts` (imports at line 4; add function after the `ApprovalStep` interface at line 13; modify `applyLeave`'s approver block at lines 113–125)
- Test: `apps/api/src/modules/leave/leave.service.test.ts` (create)

**Interfaces:**
- Produces: `export async function resolveApproverForRole(db: Prisma.TransactionClient | typeof prisma, role: string, employeeId: string, officeId: string): Promise<string | null>` — used by Tasks 2 and 4.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/leave/leave.service.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { UserRole } from '@hr-system/types'

const EMPLOYEES: Record<string, { reportingToId: string | null; departmentId: string }> = {
  'emp-1': { reportingToId: 'emp-teamlead', departmentId: 'dept-1' },
  'emp-no-manager': { reportingToId: null, departmentId: 'dept-1' },
}

const DEPARTMENTS: Record<string, { managerId: string | null }> = {
  'dept-1': { managerId: 'emp-depthead' },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    department: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => DEPARTMENTS[where.id] ?? null),
    },
    user: {
      findFirst: vi.fn(async () => ({ employeeId: 'emp-hr-manager' })),
    },
  },
}))

import { resolveApproverForRole } from './leave.service'
import { prisma } from '../../config/prisma'

describe('resolveApproverForRole', () => {
  it("resolves TEAM_LEAD level to the employee's direct manager", async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.TEAM_LEAD, 'emp-1', 'office-bd')
    expect(result).toBe('emp-teamlead')
  })

  it("resolves DEPT_HEAD level to the employee's department manager", async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.DEPT_HEAD, 'emp-1', 'office-bd')
    expect(result).toBe('emp-depthead')
  })

  it('resolves HR_MANAGER level to any user with that role in the office (unchanged behavior)', async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.HR_MANAGER, 'emp-1', 'office-bd')
    expect(result).toBe('emp-hr-manager')
  })

  it('returns null when the employee has no direct manager assigned', async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.TEAM_LEAD, 'emp-no-manager', 'office-bd')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.test.ts`
Expected: FAIL — `resolveApproverForRole` is not exported from `./leave.service`.

- [ ] **Step 3: Write the implementation**

In `apps/api/src/modules/leave/leave.service.ts`, change the import at line 4:

```ts
import { LeaveStatus, NotificationType, UserRole } from '@hr-system/types'
```

Then insert this new function directly after the `ApprovalStep` interface (after line 13, before `getLeaveTypes`):

```ts
/**
 * Resolves the correct approver for a given chain-level role and employee.
 * TEAM_LEAD/DEPT_HEAD levels route to the employee's actual manager/department
 * head (via Employee.reportingToId / Department.managerId) rather than an
 * arbitrary user holding that role in the office. HR_MANAGER/SUPER_ADMIN
 * levels are office-wide by design and keep the original "any user with that
 * role in office" resolution.
 */
export async function resolveApproverForRole(
  db: Prisma.TransactionClient | typeof prisma,
  role: string,
  employeeId: string,
  officeId: string
): Promise<string | null> {
  if (role === UserRole.TEAM_LEAD) {
    const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { reportingToId: true } })
    return emp?.reportingToId ?? null
  }
  if (role === UserRole.DEPT_HEAD) {
    const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } })
    if (!emp) return null
    const dept = await db.department.findUnique({ where: { id: emp.departmentId }, select: { managerId: true } })
    return dept?.managerId ?? null
  }
  const approver = await db.user.findFirst({
    where: { employee: { officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } }, role },
    select: { employeeId: true },
  })
  return approver?.employeeId ?? null
}
```

Then replace the initial-approver block inside `applyLeave` (currently lines 113–125):

```ts
  // Find the first approver by role in the same office
  let currentApproverId: string | null = null
  if (approvalChain.length > 0) {
    const firstRole = approvalChain[0].role
    const approver = await prisma.user.findFirst({
      where: {
        employee: { officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
        role: firstRole,
      },
      select: { employeeId: true },
    })
    currentApproverId = approver?.employeeId ?? null
  }
```

with:

```ts
  // Find the first approver, resolved to the employee's actual manager/dept head where applicable
  let currentApproverId: string | null = null
  if (approvalChain.length > 0) {
    currentApproverId = await resolveApproverForRole(prisma, approvalChain[0].role, employeeId, officeId)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/leave/leave.service.ts apps/api/src/modules/leave/leave.service.test.ts
git commit -m "feat(leave): resolve approver via real reporting chain instead of arbitrary same-role user"
```

---

### Task 2: `approveLeave` — office check, approver-identity check, real forwarding

**Files:**
- Modify: `apps/api/src/modules/leave/leave.service.ts` (replace the whole `approveLeave` function, currently lines 178–273)
- Test: `apps/api/src/modules/leave/leave.service.approve.test.ts` (create)

**Interfaces:**
- Consumes: `resolveApproverForRole(db, role, employeeId, officeId)` from Task 1.
- Produces: `approveLeave(applicationId: string, approverId: string, approvingEmployeeId: string, input: ApproveLeaveInput, approverRole: string, officeScope?: string)` — new signature (added `approverRole`, `officeScope`). Consumed by Task 5's controller wiring.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/leave/leave.service.approve.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const APPLICATIONS: Record<string, any> = {}

function makeApp(overrides: Partial<any> = {}) {
  return {
    id: 'app-1',
    employeeId: 'emp-applicant',
    status: 'PENDING',
    approvalLevel: 1,
    currentApproverId: 'emp-teamlead',
    startDate: new Date('2026-08-01'),
    totalDays: 2,
    leaveTypeId: 'lt-1',
    leaveType: {
      name: 'Annual Leave',
      approvalChain: [
        { level: 1, role: 'TEAM_LEAD' },
        { level: 2, role: 'HR_MANAGER' },
      ],
    },
    employee: { id: 'emp-applicant', firstName: 'Ann', lastName: 'Applicant', officeId: 'office-bd' },
    ...overrides,
  }
}

const txMock = {
  leaveApplication: {
    updateMany: vi.fn(async () => ({ count: 1 })),
    findUniqueOrThrow: vi.fn(async () => ({ id: 'app-1', status: 'APPROVED' })),
  },
  leaveApprovalHistory: { create: vi.fn(async () => ({})) },
  leaveBalance: { updateMany: vi.fn(async () => ({})) },
  employee: { findUnique: vi.fn(async () => null) },
  department: { findUnique: vi.fn(async () => null) },
  user: { findFirst: vi.fn(async () => ({ employeeId: 'emp-hr-manager' })) },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => APPLICATIONS[where.id] ?? null),
    },
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  },
}))

vi.mock('../../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))

import { approveLeave } from './leave.service'

beforeEach(() => {
  Object.keys(APPLICATIONS).forEach((k) => delete APPLICATIONS[k])
  vi.clearAllMocks()
})

describe('approveLeave', () => {
  it('rejects a TEAM_LEAD who is not the assigned approver', async () => {
    APPLICATIONS['app-1'] = makeApp({ currentApproverId: 'emp-other-teamlead' })
    await expect(
      approveLeave('app-1', 'user-1', 'emp-teamlead', { comment: undefined }, UserRole.TEAM_LEAD, 'office-bd')
    ).rejects.toThrow('You are not the assigned approver for this application')
  })

  it('allows the assigned TEAM_LEAD to approve and forwards to the real next-level approver', async () => {
    APPLICATIONS['app-1'] = makeApp()
    const result = await approveLeave('app-1', 'user-1', 'emp-teamlead', { comment: undefined }, UserRole.TEAM_LEAD, 'office-bd')
    expect(txMock.leaveApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentApproverId: 'emp-hr-manager', approvalLevel: 2 }) })
    )
    expect(result).toBeDefined()
  })

  it('rejects an HR_MANAGER acting outside their office', async () => {
    APPLICATIONS['app-1'] = makeApp({ employee: { id: 'emp-applicant', firstName: 'Ann', lastName: 'Applicant', officeId: 'office-uk' } })
    await expect(
      approveLeave('app-1', 'user-1', 'emp-hr-manager', { comment: undefined }, UserRole.HR_MANAGER, 'office-bd')
    ).rejects.toThrow('Leave application not found')
  })

  it('allows an HR_MANAGER to approve without being the assigned approver, within their office', async () => {
    APPLICATIONS['app-1'] = makeApp({ currentApproverId: 'emp-someone-else' })
    const result = await approveLeave('app-1', 'user-1', 'emp-hr-manager', { comment: undefined }, UserRole.HR_MANAGER, 'office-bd')
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.approve.test.ts`
Expected: FAIL — `approveLeave` does not check `currentApproverId`, so the first test's `rejects.toThrow` assertion fails (call resolves instead of throwing).

- [ ] **Step 3: Write the implementation**

Replace the entire `approveLeave` function (currently lines 178–273 of `apps/api/src/modules/leave/leave.service.ts`) with:

```ts
/** Approve a leave application (advance level or final approval). */
export async function approveLeave(
  applicationId: string,
  approverId: string,
  approvingEmployeeId: string,
  input: ApproveLeaveInput,
  approverRole: string,
  officeScope?: string
) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true, officeId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (officeScope && app.employee.officeId !== officeScope) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const isAdmin = approverRole === UserRole.SUPER_ADMIN || approverRole === UserRole.HR_MANAGER
  if (!isAdmin && app.currentApproverId !== approvingEmployeeId) {
    throw new LeaveError('You are not the assigned approver for this application', 403)
  }

  const approvalChain = (app.leaveType.approvalChain as unknown as ApprovalStep[]) ?? []
  const currentLevel = app.approvalLevel
  const isFinalLevel = currentLevel >= approvalChain.length

  const year = app.startDate.getFullYear()

  const updated = await prisma.$transaction(async (tx) => {
    let nextApproverId: string | null = null
    let newStatus = app.status

    if (isFinalLevel) {
      newStatus = LeaveStatus.APPROVED
    } else {
      // Find next level approver, resolved to the applicant's actual manager/dept head
      const nextStep = approvalChain[currentLevel] // index = currentLevel (0-indexed)
      if (nextStep) {
        nextApproverId = await resolveApproverForRole(tx, nextStep.role, app.employeeId, app.employee.officeId)
      }
    }

    // Guard the transition atomically — if another request already moved this
    // application off PENDING (double-click, retry, concurrent approve), this
    // matches zero rows and we bail out before touching history/balance.
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.PENDING },
      data: {
        status: newStatus,
        approvalLevel: isFinalLevel ? currentLevel : currentLevel + 1,
        currentApproverId: isFinalLevel ? null : nextApproverId,
        approvedById: isFinalLevel ? approvingEmployeeId : undefined,
        approvedAt: isFinalLevel ? new Date() : undefined,
      },
    })
    if (count === 0) throw new LeaveError('This application has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: approvingEmployeeId,
        action: isFinalLevel ? 'APPROVED' : 'FORWARDED',
        level: currentLevel,
        comment: input.comment,
      },
    })

    if (isFinalLevel) {
      // Move from pending to taken
      await tx.leaveBalance.updateMany({
        where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { taken: { increment: Number(app.totalDays) }, pending: { decrement: Number(app.totalDays) } },
      })
    }

    const result = await tx.leaveApplication.findUniqueOrThrow({ where: { id: applicationId } })

    return { result, isFinalLevel, nextApproverId }
  })

  const appName = `${app.employee.firstName} ${app.employee.lastName}`

  if (updated.isFinalLevel) {
    await createNotification(
      app.employeeId,
      NotificationType.LEAVE_APPROVED,
      'Leave approved',
      `Your ${app.leaveType.name} application (${Number(app.totalDays)} days) has been approved.`,
      { applicationId }
    )
  } else if (updated.nextApproverId) {
    await createNotification(
      updated.nextApproverId,
      NotificationType.LEAVE_REQUESTED,
      'Leave request awaiting your approval',
      `${appName}'s leave request has been forwarded to you for approval.`,
      { applicationId }
    )
  }

  return updated.result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.approve.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/leave/leave.service.ts apps/api/src/modules/leave/leave.service.approve.test.ts
git commit -m "feat(leave): require assigned approver + office match on approveLeave"
```

---

### Task 3: `rejectLeave` — office check, approver-identity check

**Files:**
- Modify: `apps/api/src/modules/leave/leave.service.ts` (replace the whole `rejectLeave` function, currently lines 276–325)
- Test: `apps/api/src/modules/leave/leave.service.reject.test.ts` (create)

**Interfaces:**
- Produces: `rejectLeave(applicationId: string, rejectingEmployeeId: string, input: RejectLeaveInput, approverRole: string, officeScope?: string)` — new signature. Consumed by Task 5's controller wiring.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/leave/leave.service.reject.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const APPLICATIONS: Record<string, any> = {}

function makeApp(overrides: Partial<any> = {}) {
  return {
    id: 'app-1',
    employeeId: 'emp-applicant',
    status: 'PENDING',
    approvalLevel: 1,
    currentApproverId: 'emp-teamlead',
    startDate: new Date('2026-08-01'),
    totalDays: 2,
    leaveTypeId: 'lt-1',
    leaveType: { name: 'Annual Leave' },
    employee: { id: 'emp-applicant', firstName: 'Ann', lastName: 'Applicant', officeId: 'office-bd' },
    ...overrides,
  }
}

const txMock = {
  leaveApplication: { updateMany: vi.fn(async () => ({ count: 1 })) },
  leaveApprovalHistory: { create: vi.fn(async () => ({})) },
  leaveBalance: { updateMany: vi.fn(async () => ({})) },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => APPLICATIONS[where.id] ?? null),
    },
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  },
}))

vi.mock('../../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))

import { rejectLeave } from './leave.service'

beforeEach(() => {
  Object.keys(APPLICATIONS).forEach((k) => delete APPLICATIONS[k])
  vi.clearAllMocks()
})

describe('rejectLeave', () => {
  it('rejects a TEAM_LEAD who is not the assigned approver', async () => {
    APPLICATIONS['app-1'] = makeApp({ currentApproverId: 'emp-other-teamlead' })
    await expect(
      rejectLeave('app-1', 'emp-teamlead', { rejectionReason: 'no' }, UserRole.TEAM_LEAD, 'office-bd')
    ).rejects.toThrow('You are not the assigned approver for this application')
  })

  it('allows the assigned TEAM_LEAD to reject', async () => {
    APPLICATIONS['app-1'] = makeApp()
    const result = await rejectLeave('app-1', 'emp-teamlead', { rejectionReason: 'no' }, UserRole.TEAM_LEAD, 'office-bd')
    expect(result).toEqual({ message: 'Application rejected' })
    expect(txMock.leaveApplication.updateMany).toHaveBeenCalled()
  })

  it('rejects a request for an application in another office', async () => {
    APPLICATIONS['app-1'] = makeApp({ employee: { id: 'emp-applicant', firstName: 'Ann', lastName: 'Applicant', officeId: 'office-uk' } })
    await expect(
      rejectLeave('app-1', 'emp-hr-manager', { rejectionReason: 'no' }, UserRole.HR_MANAGER, 'office-bd')
    ).rejects.toThrow('Leave application not found')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.reject.test.ts`
Expected: FAIL — `rejectLeave` doesn't check `currentApproverId` or office, so the first and third tests resolve instead of throwing.

- [ ] **Step 3: Write the implementation**

Replace the entire `rejectLeave` function (currently lines 276–325) with:

```ts
/** Reject a leave application. */
export async function rejectLeave(
  applicationId: string,
  rejectingEmployeeId: string,
  input: RejectLeaveInput,
  approverRole: string,
  officeScope?: string
) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, officeId: true } } },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (officeScope && app.employee.officeId !== officeScope) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const isAdmin = approverRole === UserRole.SUPER_ADMIN || approverRole === UserRole.HR_MANAGER
  if (!isAdmin && app.currentApproverId !== rejectingEmployeeId) {
    throw new LeaveError('You are not the assigned approver for this application', 403)
  }

  const year = app.startDate.getFullYear()

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.PENDING },
      data: {
        status: LeaveStatus.REJECTED,
        rejectedById: rejectingEmployeeId,
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason,
        currentApproverId: null,
      },
    })
    if (count === 0) throw new LeaveError('This application has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: rejectingEmployeeId,
        action: 'REJECTED',
        level: app.approvalLevel,
        comment: input.rejectionReason,
      },
    })

    // Release reserved balance
    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { pending: { decrement: Number(app.totalDays) } },
    })
  })

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_REJECTED,
    'Leave request rejected',
    `Your ${app.leaveType.name} application was rejected. Reason: ${input.rejectionReason}`,
    { applicationId }
  )

  return { message: 'Application rejected' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.reject.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/leave/leave.service.ts apps/api/src/modules/leave/leave.service.reject.test.ts
git commit -m "feat(leave): require assigned approver + office match on rejectLeave"
```

---

### Task 4: `cancelLeave` fallback resolver + `approveCancelLeave`/`rejectCancelLeave` checks

**Files:**
- Modify: `apps/api/src/modules/leave/leave.service.ts` (fallback block inside `cancelLeave`, currently lines 376–387; `approveCancelLeave`, currently lines 435–490; `rejectCancelLeave`, currently lines 493–536)
- Test: `apps/api/src/modules/leave/leave.service.cancel.test.ts` (create)

**Interfaces:**
- Consumes: `resolveApproverForRole` from Task 1.
- Produces: `approveCancelLeave(applicationId: string, approvingEmployeeId: string, approverRole: string, officeScope?: string)` and `rejectCancelLeave(applicationId: string, rejectingEmployeeId: string, reason: string, approverRole: string, officeScope?: string)` — new signatures. Consumed by Task 5's controller wiring.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/leave/leave.service.cancel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const APPLICATIONS: Record<string, any> = {}
const EMPLOYEES: Record<string, { reportingToId: string | null; departmentId: string }> = {
  'emp-applicant': { reportingToId: 'emp-teamlead', departmentId: 'dept-1' },
}
const DEPARTMENTS: Record<string, { managerId: string | null }> = {
  'dept-1': { managerId: 'emp-depthead' },
}

function makeApp(overrides: Partial<any> = {}) {
  return {
    id: 'app-1',
    employeeId: 'emp-applicant',
    status: 'APPROVED',
    approvalLevel: 1,
    currentApproverId: null,
    startDate: new Date('2099-08-01'),
    totalDays: 2,
    leaveTypeId: 'lt-1',
    leaveType: { name: 'Annual Leave' },
    employee: { id: 'emp-applicant', firstName: 'Ann', lastName: 'Applicant', officeId: 'office-bd' },
    ...overrides,
  }
}

const leaveApplicationUpdateMany = vi.fn(async () => ({ count: 1 }))
const txMock = {
  leaveApplication: { updateMany: vi.fn(async () => ({ count: 1 })) },
  leaveApprovalHistory: { create: vi.fn(async () => ({})) },
  leaveBalance: { updateMany: vi.fn(async () => ({})) },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => APPLICATIONS[where.id] ?? null),
      updateMany: leaveApplicationUpdateMany,
    },
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    department: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => DEPARTMENTS[where.id] ?? null),
    },
    user: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  },
}))

vi.mock('../../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))

import { cancelLeave, approveCancelLeave, rejectCancelLeave } from './leave.service'

beforeEach(() => {
  Object.keys(APPLICATIONS).forEach((k) => delete APPLICATIONS[k])
  vi.clearAllMocks()
  leaveApplicationUpdateMany.mockResolvedValue({ count: 1 })
})

describe('cancelLeave fallback approver resolution', () => {
  it("falls back to the employee's real direct manager, not an arbitrary team lead", async () => {
    APPLICATIONS['app-1'] = makeApp()
    await cancelLeave('app-1', 'emp-applicant', 'need to leave early')
    expect(leaveApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentApproverId: 'emp-teamlead' }) })
    )
  })
})

describe('approveCancelLeave', () => {
  it('rejects a TEAM_LEAD who is not the assigned approver', async () => {
    APPLICATIONS['app-1'] = makeApp({ status: 'CANCEL_REQUESTED', currentApproverId: 'emp-other-teamlead' })
    await expect(
      approveCancelLeave('app-1', 'emp-teamlead', UserRole.TEAM_LEAD, 'office-bd')
    ).rejects.toThrow('You are not the assigned approver for this application')
  })

  it('allows the assigned TEAM_LEAD to approve the cancellation', async () => {
    APPLICATIONS['app-1'] = makeApp({ status: 'CANCEL_REQUESTED', currentApproverId: 'emp-teamlead' })
    const result = await approveCancelLeave('app-1', 'emp-teamlead', UserRole.TEAM_LEAD, 'office-bd')
    expect(result).toEqual({ message: 'Cancellation approved' })
  })
})

describe('rejectCancelLeave', () => {
  it('rejects a request for an application in another office', async () => {
    APPLICATIONS['app-1'] = makeApp({
      status: 'CANCEL_REQUESTED',
      employee: { id: 'emp-applicant', officeId: 'office-uk' },
    })
    await expect(
      rejectCancelLeave('app-1', 'emp-hr-manager', 'not valid', UserRole.HR_MANAGER, 'office-bd')
    ).rejects.toThrow('Leave application not found')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.cancel.test.ts`
Expected: FAIL — the fallback resolver still queries `prisma.user.findFirst` (mocked to return `null` here) instead of the employee's `reportingToId`, so the first test's `currentApproverId` assertion fails; `approveCancelLeave`/`rejectCancelLeave` don't accept/check `approverRole`/`officeScope` yet (TS error on extra args).

- [ ] **Step 3: Write the implementation**

In `cancelLeave`, replace the fallback-approver block (currently lines 376–387):

```ts
  // Find the original approver or any team lead in the office
  let managerId = app.currentApproverId
  if (!managerId) {
    const mgr = await prisma.user.findFirst({
      where: {
        employee: { officeId: app.employee.officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
        role: { in: ['TEAM_LEAD', 'HR_MANAGER', 'DEPT_HEAD'] },
      },
      select: { employeeId: true },
    })
    managerId = mgr?.employeeId ?? null
  }
```

with:

```ts
  // Find the original approver, falling back to the employee's real manager chain
  let managerId = app.currentApproverId
  if (!managerId) {
    managerId = await resolveApproverForRole(prisma, UserRole.TEAM_LEAD, employeeId, app.employee.officeId)
      ?? await resolveApproverForRole(prisma, UserRole.DEPT_HEAD, employeeId, app.employee.officeId)
      ?? await resolveApproverForRole(prisma, UserRole.HR_MANAGER, employeeId, app.employee.officeId)
  }
```

Replace the start of `approveCancelLeave` (currently lines 435–444):

```ts
export async function approveCancelLeave(applicationId: string, approvingEmployeeId: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')
```

with:

```ts
export async function approveCancelLeave(
  applicationId: string,
  approvingEmployeeId: string,
  approverRole: string,
  officeScope?: string
) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true, officeId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (officeScope && app.employee.officeId !== officeScope) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  const isAdmin = approverRole === UserRole.SUPER_ADMIN || approverRole === UserRole.HR_MANAGER
  if (!isAdmin && app.currentApproverId !== approvingEmployeeId) {
    throw new LeaveError('You are not the assigned approver for this application', 403)
  }
```

Replace the start of `rejectCancelLeave` (currently lines 493–502):

```ts
export async function rejectCancelLeave(applicationId: string, rejectingEmployeeId: string, reason: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')
```

with:

```ts
export async function rejectCancelLeave(
  applicationId: string,
  rejectingEmployeeId: string,
  reason: string,
  approverRole: string,
  officeScope?: string
) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, officeId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (officeScope && app.employee.officeId !== officeScope) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  const isAdmin = approverRole === UserRole.SUPER_ADMIN || approverRole === UserRole.HR_MANAGER
  if (!isAdmin && app.currentApproverId !== rejectingEmployeeId) {
    throw new LeaveError('You are not the assigned approver for this application', 403)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- leave.service.cancel.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/leave/leave.service.ts apps/api/src/modules/leave/leave.service.cancel.test.ts
git commit -m "feat(leave): resolve real manager as cancel fallback; check assigned approver on cancel-approve/reject"
```

---

### Task 5: Wire routes + controller; end-to-end regression test

**Files:**
- Modify: `apps/api/src/modules/leave/leave.routes.ts` (lines 32, 38, 40, 41, 44, 45)
- Modify: `apps/api/src/modules/leave/leave.controller.ts` (functions `approve`, `reject`, `approveCancel`, `rejectCancel`, currently lines 78–117)
- Modify: `apps/api/src/__tests__/tenant-isolation.test.ts` (extend existing mock data/factory; add new describe block)

**Interfaces:**
- Consumes: `service.approveLeave(applicationId, approverId, approvingEmployeeId, input, approverRole, officeScope)`, `service.rejectLeave(applicationId, rejectingEmployeeId, input, approverRole, officeScope)`, `service.approveCancelLeave(applicationId, approvingEmployeeId, approverRole, officeScope)`, `service.rejectCancelLeave(applicationId, rejectingEmployeeId, reason, approverRole, officeScope)` from Tasks 2–4.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/__tests__/tenant-isolation.test.ts`, add fields to the existing `LEAVE_APPLICATIONS` map (replace the whole object, currently lines 10–25):

```ts
const LEAVE_APPLICATIONS: Record<string, unknown> = {
  'app-bd': {
    id: 'app-bd',
    employeeId: 'emp-owner-bd',
    status: 'PENDING',
    approvalLevel: 1,
    currentApproverId: 'emp-owner-bd-teamlead',
    startDate: new Date('2026-08-01'),
    totalDays: 1,
    leaveTypeId: 'lt-1',
    employee: { id: 'emp-owner-bd', firstName: 'Bashir', lastName: 'Rahman', employeeId: 'BD-2026-001', officeId: 'office-bd' },
    leaveType: { id: 'lt-1', name: 'Annual Leave', code: 'AL', approvalChain: [{ level: 1, role: 'TEAM_LEAD' }] },
    approvalHistory: [],
  },
  'app-uk': {
    id: 'app-uk',
    employeeId: 'emp-owner-uk',
    status: 'PENDING',
    approvalLevel: 1,
    currentApproverId: 'emp-owner-uk-teamlead',
    startDate: new Date('2026-08-01'),
    totalDays: 1,
    leaveTypeId: 'lt-2',
    employee: { id: 'emp-owner-uk', firstName: 'James', lastName: 'Smith', employeeId: 'UK-2026-001', officeId: 'office-uk' },
    leaveType: { id: 'lt-2', name: 'Annual Leave', code: 'AL', approvalChain: [{ level: 1, role: 'TEAM_LEAD' }] },
    approvalHistory: [],
  },
}
```

Replace the `vi.mock('../config/prisma', ...)` block (currently lines 32–41) with:

```ts
vi.mock('../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => LEAVE_APPLICATIONS[where.id] ?? null),
    },
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        leaveApplication: {
          updateMany: vi.fn(async () => ({ count: 1 })),
          findUniqueOrThrow: vi.fn(async () => ({ id: 'app-bd', status: 'APPROVED' })),
        },
        leaveApprovalHistory: { create: vi.fn(async () => ({})) },
        leaveBalance: { updateMany: vi.fn(async () => ({})) },
        employee: { findUnique: vi.fn(async () => null) },
        department: { findUnique: vi.fn(async () => null) },
        user: { findFirst: vi.fn(async () => null) },
      })
    ),
  },
}))

vi.mock('../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))
```

Add a new describe block at the end of the file:

```ts
describe('tenant isolation — leave approvals', () => {
  it('blocks an HR_MANAGER from approving an application in another office', async () => {
    const token = tokenFor({ role: UserRole.HR_MANAGER, officeId: 'office-bd' })
    const res = await request(app)
      .patch('/api/v1/leave/applications/app-uk/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(404)
  })

  it('blocks a TEAM_LEAD who is not the assigned approver from approving', async () => {
    const token = tokenFor({ role: UserRole.TEAM_LEAD, officeId: 'office-bd' })
    const res = await request(app)
      .patch('/api/v1/leave/applications/app-bd/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('allows the assigned TEAM_LEAD to approve within their office', async () => {
    const token = signAccessToken({
      id: 'user-teamlead-bd',
      employeeId: 'emp-owner-bd-teamlead',
      email: 'teamlead@test.com',
      role: UserRole.TEAM_LEAD,
      officeId: 'office-bd',
      officeCode: 'BD',
      firstName: 'Test',
      lastName: 'Lead',
    })
    const res = await request(app)
      .patch('/api/v1/leave/applications/app-bd/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- tenant-isolation.test.ts`
Expected: FAIL — the approve route has no `officeScope` middleware, so the first test gets 200/500 instead of 404; the second test gets 200 instead of 403 (no identity check reachable via HTTP yet since the controller hasn't been updated to pass `u.role`/`scope(req)`).

- [ ] **Step 3: Write the implementation**

In `apps/api/src/modules/leave/leave.routes.ts`, replace lines 32, 38, 40, 41, 44, 45:

```ts
leaveRouter.get('/balances/:employeeId', officeScope, requireRole(UserRole.TEAM_LEAD), ctrl.getBalances)
```
stays unchanged. Replace the rest of the block (lines 38–45) with:

```ts
leaveRouter.get('/applications/pending', officeScope, requireRole(UserRole.TEAM_LEAD), ctrl.getPending)
leaveRouter.get('/applications/:id', officeScope, ctrl.getApplication)
leaveRouter.patch('/applications/:id/approve', officeScope, requireRole(UserRole.TEAM_LEAD), validate(approveLeaveSchema), ctrl.approve)
leaveRouter.patch('/applications/:id/reject', officeScope, requireRole(UserRole.TEAM_LEAD), validate(rejectLeaveSchema), ctrl.reject)
leaveRouter.patch('/applications/:id/cancel', validate(cancelLeaveSchema), ctrl.cancel)
leaveRouter.patch('/applications/:id/cancel-reason', validate(updateCancelReasonSchema), ctrl.updateCancelReason)
leaveRouter.patch('/applications/:id/cancel-approve', officeScope, requireRole(UserRole.TEAM_LEAD), ctrl.approveCancel)
leaveRouter.patch('/applications/:id/cancel-reject', officeScope, requireRole(UserRole.TEAM_LEAD), validate(rejectCancelLeaveSchema), ctrl.rejectCancel)
```

In `apps/api/src/modules/leave/leave.controller.ts`, replace the `approve`/`reject`/`approveCancel`/`rejectCancel` functions (currently lines 78–117 excluding `cancel`/`updateCancelReason` in between):

```ts
export async function approve(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.approveLeave(req.params.id, u.sub, u.employeeId, req.body as ApproveLeaveInput, u.role, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.APPROVE, 'LeaveApplication', req.params.id)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function reject(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.rejectLeave(req.params.id, u.employeeId, req.body as RejectLeaveInput, u.role, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.REJECT, 'LeaveApplication', req.params.id, undefined, req.body)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}
```

and:

```ts
export async function approveCancel(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.approveCancelLeave(req.params.id, u.employeeId, u.role, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.APPROVE, 'LeaveApplication', req.params.id, undefined, { action: 'cancel-approve' })
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function rejectCancel(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.rejectCancelLeave(req.params.id, u.employeeId, (req.body as RejectCancelLeaveInput).reason, u.role, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.REJECT, 'LeaveApplication', req.params.id, undefined, { action: 'cancel-reject', ...req.body })
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- tenant-isolation.test.ts`
Expected: PASS (all tests in the file, including the 3 new ones and the 4 pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/leave/leave.routes.ts apps/api/src/modules/leave/leave.controller.ts apps/api/src/__tests__/tenant-isolation.test.ts
git commit -m "fix(leave): wire officeScope into pending/approve/reject/cancel routes, close cross-office leak"
```

---

### Task 6: Attendance — scope `listPendingExcuses` by role

**Files:**
- Modify: `apps/api/src/modules/attendance/attendance.service.ts` (import at line 4; `listPendingExcuses`, currently lines 434–453)
- Modify: `apps/api/src/modules/attendance/attendance.controller.ts` (`listPendingExcuses`, currently lines 107–112)
- Test: `apps/api/src/modules/attendance/attendance.service.test.ts` (create)

**Interfaces:**
- Produces: `listPendingExcuses(officeScope: string | undefined, requesterEmployeeId: string, requesterRole: string)` — new signature. Consumed by Task 7 (shares the test file) and already consumed by the Task 6 controller change.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/attendance/attendance.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const attendanceFindMany = vi.fn(async () => [])
const departmentFindMany = vi.fn(async () => [{ id: 'dept-1' }])

vi.mock('../../config/prisma', () => ({
  prisma: {
    attendance: {
      findMany: attendanceFindMany,
    },
    department: {
      findMany: departmentFindMany,
    },
  },
}))

import { listPendingExcuses } from './attendance.service'

beforeEach(() => {
  vi.clearAllMocks()
  attendanceFindMany.mockResolvedValue([])
  departmentFindMany.mockResolvedValue([{ id: 'dept-1' }])
})

describe('listPendingExcuses', () => {
  it('scopes a TEAM_LEAD to their own direct reports', async () => {
    await listPendingExcuses('office-bd', 'emp-teamlead', UserRole.TEAM_LEAD)
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: expect.objectContaining({ officeId: 'office-bd', reportingToId: 'emp-teamlead' }),
        }),
      })
    )
  })

  it('scopes a DEPT_HEAD to departments they manage', async () => {
    await listPendingExcuses('office-bd', 'emp-depthead', UserRole.DEPT_HEAD)
    expect(departmentFindMany).toHaveBeenCalledWith({ where: { managerId: 'emp-depthead' }, select: { id: true } })
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: expect.objectContaining({ officeId: 'office-bd', departmentId: { in: ['dept-1'] } }),
        }),
      })
    )
  })

  it('leaves HR_MANAGER office-wide with no extra employee filter', async () => {
    await listPendingExcuses('office-bd', 'emp-hr', UserRole.HR_MANAGER)
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employee: { officeId: 'office-bd' } }),
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- attendance.service.test.ts`
Expected: FAIL — TS error, `listPendingExcuses` currently takes only one parameter (`officeScope`).

- [ ] **Step 3: Write the implementation**

In `apps/api/src/modules/attendance/attendance.service.ts`, change the import at line 4:

```ts
import { AttendanceStatus, AttendanceSource, NotificationType, UserRole } from '@hr-system/types'
```

Replace `listPendingExcuses` (currently lines 434–453):

```ts
/** List pending late excuses for manager review, scoped to the reviewer's actual reports. */
export async function listPendingExcuses(officeScope: string | undefined, requesterEmployeeId: string, requesterRole: string) {
  const employeeFilter: Prisma.EmployeeWhereInput = {
    ...(officeScope ? { officeId: officeScope } : {}),
  }
  if (requesterRole === UserRole.TEAM_LEAD) {
    employeeFilter.reportingToId = requesterEmployeeId
  } else if (requesterRole === UserRole.DEPT_HEAD) {
    const depts = await prisma.department.findMany({ where: { managerId: requesterEmployeeId }, select: { id: true } })
    employeeFilter.departmentId = { in: depts.map((d) => d.id) }
  }

  return prisma.attendance.findMany({
    where: {
      excuseStatus: 'PENDING',
      employee: employeeFilter,
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true,
          department: { select: { id: true, name: true } },
          user: { select: { role: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })
}
```

In `apps/api/src/modules/attendance/attendance.controller.ts`, replace `listPendingExcuses` (currently lines 107–112):

```ts
export async function listPendingExcuses(req: Request, res: Response) {
  try {
    const items = await service.listPendingExcuses(scope(req), user(req).employeeId, user(req).role)
    sendSuccess(res, items)
  } catch (err) { handle(res, err) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- attendance.service.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/attendance/attendance.service.ts apps/api/src/modules/attendance/attendance.controller.ts apps/api/src/modules/attendance/attendance.service.test.ts
git commit -m "feat(attendance): scope pending excuse list to reviewer's direct reports or managed department"
```

---

### Task 7: Attendance — office check + identity check on `reviewExcuse`

**Files:**
- Modify: `apps/api/src/modules/attendance/attendance.service.ts` (`reviewExcuse`, currently lines 402–432)
- Modify: `apps/api/src/modules/attendance/attendance.controller.ts` (`reviewExcuse`, currently lines 98–105)
- Modify: `apps/api/src/modules/attendance/attendance.service.test.ts` (extend mock factory + imports; add describe block)

**Interfaces:**
- Produces: `reviewExcuse(attendanceId: string, managerId: string, approved: boolean, reviewerRole: string, officeScope: string | undefined, newStatus?: string)` — new signature (parameter order changed: `reviewerRole` and `officeScope` inserted before the existing optional `newStatus`).

- [ ] **Step 1: Write the failing test**

In `apps/api/src/modules/attendance/attendance.service.test.ts`, replace the `vi.mock('../../config/prisma', ...)` block with:

```ts
const RECORDS: Record<string, any> = {}
const attendanceFindMany = vi.fn(async () => [])
const departmentFindMany = vi.fn(async () => [{ id: 'dept-1' }])
const departmentFindFirst = vi.fn(async () => null)
const attendanceUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({
  id: where.id,
  employee: { id: 'emp-1', firstName: 'A', lastName: 'B' },
}))

vi.mock('../../config/prisma', () => ({
  prisma: {
    attendance: {
      findMany: attendanceFindMany,
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => RECORDS[where.id] ?? null),
      update: attendanceUpdate,
    },
    department: {
      findMany: departmentFindMany,
      findFirst: departmentFindFirst,
    },
  },
}))

vi.mock('../../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))
```

Replace the import line with:

```ts
import { listPendingExcuses, reviewExcuse } from './attendance.service'
```

Add a helper and a new describe block at the end of the file:

```ts
function makeRecord(overrides: Partial<any> = {}) {
  return {
    id: 'att-1',
    employeeId: 'emp-1',
    lateExcuse: 'traffic',
    excuseStatus: 'PENDING',
    employee: { officeId: 'office-bd', reportingToId: 'emp-teamlead', departmentId: 'dept-1' },
    ...overrides,
  }
}

describe('reviewExcuse', () => {
  beforeEach(() => {
    Object.keys(RECORDS).forEach((k) => delete RECORDS[k])
    departmentFindFirst.mockResolvedValue(null)
  })

  it('rejects a TEAM_LEAD reviewing an excuse for someone who is not their direct report', async () => {
    RECORDS['att-1'] = makeRecord({ employee: { officeId: 'office-bd', reportingToId: 'emp-other-teamlead', departmentId: 'dept-1' } })
    await expect(
      reviewExcuse('att-1', 'emp-teamlead', true, UserRole.TEAM_LEAD, 'office-bd')
    ).rejects.toThrow('You are not authorized to review this excuse')
  })

  it("allows a TEAM_LEAD to review their direct report's excuse", async () => {
    RECORDS['att-1'] = makeRecord()
    const result = await reviewExcuse('att-1', 'emp-teamlead', true, UserRole.TEAM_LEAD, 'office-bd')
    expect(result).toBeDefined()
  })

  it('rejects a cross-office review attempt', async () => {
    RECORDS['att-1'] = makeRecord({ employee: { officeId: 'office-uk', reportingToId: 'emp-teamlead', departmentId: 'dept-1' } })
    await expect(
      reviewExcuse('att-1', 'emp-teamlead', true, UserRole.TEAM_LEAD, 'office-bd')
    ).rejects.toThrow('Attendance record not found')
  })

  it("allows a DEPT_HEAD who manages the employee's department", async () => {
    RECORDS['att-1'] = makeRecord()
    departmentFindFirst.mockResolvedValue({ id: 'dept-1' })
    const result = await reviewExcuse('att-1', 'emp-depthead', true, UserRole.DEPT_HEAD, 'office-bd')
    expect(result).toBeDefined()
  })

  it("rejects a DEPT_HEAD who does not manage the employee's department", async () => {
    RECORDS['att-1'] = makeRecord()
    departmentFindFirst.mockResolvedValue(null)
    await expect(
      reviewExcuse('att-1', 'emp-other-depthead', true, UserRole.DEPT_HEAD, 'office-bd')
    ).rejects.toThrow('You are not authorized to review this excuse')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- attendance.service.test.ts`
Expected: FAIL — `reviewExcuse` doesn't accept `reviewerRole`/`officeScope` yet and performs no scope check, so most assertions in the new describe block fail (calls resolve instead of throwing, or throw a TS signature error).

- [ ] **Step 3: Write the implementation**

Replace `reviewExcuse` (currently lines 402–432 of `apps/api/src/modules/attendance/attendance.service.ts`):

```ts
export async function reviewExcuse(
  attendanceId: string,
  managerId: string,
  approved: boolean,
  reviewerRole: string,
  officeScope: string | undefined,
  newStatus?: string
) {
  const record = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { employee: { select: { officeId: true, reportingToId: true, departmentId: true } } },
  })
  if (!record) throw new AttendanceError('Attendance record not found', 404)
  if (officeScope && record.employee.officeId !== officeScope) throw new AttendanceError('Attendance record not found', 404)
  if (!record.lateExcuse) throw new AttendanceError('No excuse submitted for this record', 400)
  if (record.excuseStatus !== 'PENDING') throw new AttendanceError('Excuse already reviewed', 400)

  if (reviewerRole === UserRole.TEAM_LEAD && record.employee.reportingToId !== managerId) {
    throw new AttendanceError('You are not authorized to review this excuse', 403)
  }
  if (reviewerRole === UserRole.DEPT_HEAD) {
    const dept = await prisma.department.findFirst({ where: { id: record.employee.departmentId, managerId } })
    if (!dept) throw new AttendanceError('You are not authorized to review this excuse', 403)
  }

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      excuseStatus: approved ? 'APPROVED' : 'REJECTED',
      excuseReviewedAt: new Date(),
      excuseReviewedBy: managerId,
      ...(approved && newStatus ? { status: newStatus } : {}),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // Notify employee of the decision
  await createNotification(
    record.employeeId,
    NotificationType.ATTENDANCE_FLAGGED,
    approved ? 'Late excuse approved' : 'Late excuse rejected',
    approved
      ? 'Your late excuse has been approved by your manager.'
      : 'Your late excuse was reviewed and not approved.'
  )

  return updated
}
```

Replace `reviewExcuse` in `apps/api/src/modules/attendance/attendance.controller.ts` (currently lines 98–105):

```ts
export async function reviewExcuse(req: Request, res: Response) {
  try {
    const u = user(req)
    const { approved, newStatus } = req.body as ReviewExcuseInput
    const record = await service.reviewExcuse(req.params.id, u.employeeId, approved, u.role, scope(req), newStatus)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- attendance.service.test.ts`
Expected: PASS (8 tests total: 3 from Task 6 + 5 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/attendance/attendance.service.ts apps/api/src/modules/attendance/attendance.controller.ts apps/api/src/modules/attendance/attendance.service.test.ts
git commit -m "fix(attendance): add missing office check and team/department identity check to reviewExcuse"
```

---

### Task 8: Salary — fix the buggy self-read check

**Files:**
- Modify: `apps/api/src/modules/salary/salary.controller.ts` (`getForEmployee`, currently lines 32–48)
- Modify: `apps/api/src/__tests__/tenant-isolation.test.ts` (extend `EMPLOYEES` map + prisma mock; add tests to the existing salary describe block)

- [ ] **Step 1: Write the failing test**

In `apps/api/src/__tests__/tenant-isolation.test.ts`, add an entry to the existing `EMPLOYEES` map (currently lines 27–30):

```ts
const EMPLOYEES: Record<string, { officeId: string }> = {
  'emp-bd': { officeId: 'office-bd' },
  'emp-uk': { officeId: 'office-uk' },
  'emp-owner-bd': { officeId: 'office-bd' },
}
```

Add a `salaryStructure` mock to the existing `vi.mock('../config/prisma', ...)` factory (inside the `prisma` object, alongside `leaveApplication`/`employee`/`$transaction`):

```ts
    salaryStructure: {
      findFirst: vi.fn(async () => null),
    },
```

Add two tests to the existing `describe('tenant isolation — salary', ...)` block:

```ts
  it("blocks a TEAM_LEAD from reading an arbitrary employee's salary", async () => {
    const token = tokenFor({ role: UserRole.TEAM_LEAD, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/salary/emp-uk')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('allows an employee to read their own salary', async () => {
    const token = tokenFor({ role: UserRole.EMPLOYEE, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/salary/emp-owner-bd')
      .set('Authorization', `Bearer ${token}`)
    // No salary structure is mocked as existing — 404 here proves the self-read
    // check let the request through to the business logic, not blocked by auth.
    expect(res.status).toBe(404)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- tenant-isolation.test.ts`
Expected: FAIL — the first new test gets 200 instead of 403, because `getForEmployee`'s current check only blocks `role === 'EMPLOYEE'`, letting TEAM_LEAD through.

- [ ] **Step 3: Write the implementation**

In `apps/api/src/modules/salary/salary.controller.ts`, add an import:

```ts
import { isSelfOrRole } from '../../middleware/rbac.middleware'
import { UserRole } from '@hr-system/types'
```

Replace the self-check inside `getForEmployee` (currently lines 36–39):

```ts
    // Employees can only view their own salary
    if (authReq.user.role === 'EMPLOYEE' && authReq.user.employeeId !== employeeId) {
      sendError(res, 'Forbidden', 403); return
    }
```

with:

```ts
    if (!isSelfOrRole(authReq.user, employeeId, UserRole.HR_MANAGER)) {
      sendError(res, 'Forbidden', 403); return
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- tenant-isolation.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/salary/salary.controller.ts apps/api/src/__tests__/tenant-isolation.test.ts
git commit -m "fix(salary): block TEAM_LEAD/DEPT_HEAD from reading an arbitrary employee's salary"
```

---

### Task 9: Salary — open create/list to HR_MANAGER with office scoping

**Files:**
- Modify: `apps/api/src/modules/salary/salary.routes.ts` (lines 14–15)
- Modify: `apps/api/src/modules/salary/salary.service.ts` (`createSalaryStructure`, currently lines 41–66; `listSalaryStructures`, currently lines 68–91)
- Modify: `apps/api/src/modules/salary/salary.controller.ts` (`create`, `list`, currently lines 17–30)
- Test: `apps/api/src/modules/salary/salary.service.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/salary/salary.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const EMPLOYEES: Record<string, { id: string; officeId: string }> = {
  'emp-bd': { id: 'emp-bd', officeId: 'office-bd' },
  'emp-uk': { id: 'emp-uk', officeId: 'office-uk' },
}
const JOB_GRADES: Record<string, { id: string; officeId: string }> = {
  'grade-bd': { id: 'grade-bd', officeId: 'office-bd' },
}

const salaryStructureCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ss-1', ...data }))
const salaryStructureFindMany = vi.fn(async () => [])
const salaryStructureCount = vi.fn(async () => 0)

vi.mock('../../config/prisma', () => ({
  prisma: {
    employee: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null) },
    jobGrade: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => JOB_GRADES[where.id] ?? null) },
    salaryStructure: {
      create: salaryStructureCreate,
      findMany: salaryStructureFindMany,
      count: salaryStructureCount,
    },
  },
}))

import { createSalaryStructure, listSalaryStructures } from './salary.service'
import type { CreateSalaryStructureInput, ListSalaryQuery } from './salary.schemas'

beforeEach(() => {
  vi.clearAllMocks()
  salaryStructureFindMany.mockResolvedValue([])
  salaryStructureCount.mockResolvedValue(0)
})

const BASE_INPUT = {
  basicSalary: 50000,
  currency: 'BDT',
  components: [],
  effectiveFrom: '2026-01-01',
}

describe('createSalaryStructure office scoping', () => {
  it('rejects creating a structure for an employee in another office', async () => {
    await expect(
      createSalaryStructure({ ...BASE_INPUT, employeeId: 'emp-uk' } as CreateSalaryStructureInput, 'office-bd')
    ).rejects.toThrow('Employee not found')
  })

  it("allows creating a structure for an employee in the caller's office", async () => {
    const result = await createSalaryStructure({ ...BASE_INPUT, employeeId: 'emp-bd' } as CreateSalaryStructureInput, 'office-bd')
    expect(result.id).toBe('ss-1')
  })

  it('allows a SUPER_ADMIN (no officeScope) to create for any employee', async () => {
    const result = await createSalaryStructure({ ...BASE_INPUT, employeeId: 'emp-uk' } as CreateSalaryStructureInput, undefined)
    expect(result.id).toBe('ss-1')
  })
})

describe('listSalaryStructures office scoping', () => {
  it('filters by office when an officeScope is set', async () => {
    await listSalaryStructures({ page: 1, limit: 20 } as ListSalaryQuery, 'office-bd')
    expect(salaryStructureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ employee: { officeId: 'office-bd' } }, { jobGrade: { officeId: 'office-bd' } }],
        }),
      })
    )
  })

  it('does not filter by office for a SUPER_ADMIN', async () => {
    await listSalaryStructures({ page: 1, limit: 20 } as ListSalaryQuery, undefined)
    expect(salaryStructureFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm@9 --filter @hr-system/api test -- salary.service.test.ts`
Expected: FAIL — `createSalaryStructure`/`listSalaryStructures` don't accept an `officeScope` second argument yet, and don't validate/filter by office, so the office-mismatch test resolves instead of throwing and the filter-shape assertions don't match.

- [ ] **Step 3: Write the implementation**

In `apps/api/src/modules/salary/salary.routes.ts`, replace lines 14–15:

```ts
salaryRouter.post('/', requireRole(UserRole.HR_MANAGER), validate(createSalaryStructureSchema), ctrl.create)
salaryRouter.get('/', requireRole(UserRole.HR_MANAGER), validate(listSalaryQuery, 'query'), ctrl.list)
```

In `apps/api/src/modules/salary/salary.service.ts`, replace `createSalaryStructure` (currently lines 41–66):

```ts
export async function createSalaryStructure(input: CreateSalaryStructureInput, officeScope?: string) {
  if (input.employeeId) {
    const exists = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, officeId: true } })
    if (!exists) throw new SalaryError('Employee not found', 404)
    if (officeScope && exists.officeId !== officeScope) throw new SalaryError('Employee not found', 404)
  }
  if (input.jobGradeId) {
    const exists = await prisma.jobGrade.findUnique({ where: { id: input.jobGradeId }, select: { id: true, officeId: true } })
    if (!exists) throw new SalaryError('Job grade not found', 404)
    if (officeScope && exists.officeId !== officeScope) throw new SalaryError('Job grade not found', 404)
  }

  return prisma.salaryStructure.create({
    data: {
      employeeId: input.employeeId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      basicSalary: input.basicSalary,
      currency: input.currency,
      components: input.components as unknown as Prisma.InputJsonValue,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      jobGrade: { select: { id: true, name: true } },
    },
  })
}
```

Replace `listSalaryStructures` (currently lines 68–91):

```ts
export async function listSalaryStructures(query: ListSalaryQuery, officeScope?: string) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.SalaryStructureWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.jobGradeId ? { jobGradeId: query.jobGradeId } : {}),
    ...(officeScope ? { OR: [{ employee: { officeId: officeScope } }, { jobGrade: { officeId: officeScope } }] } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      where,
      skip,
      take,
      orderBy: { effectiveFrom: 'desc' },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        jobGrade: { select: { id: true, name: true } },
      },
    }),
    prisma.salaryStructure.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}
```

In `apps/api/src/modules/salary/salary.controller.ts`, replace `create` and `list` (currently lines 17–30):

```ts
export async function create(req: Request, res: Response) {
  try {
    const officeScope = (req as OfficeScopedRequest).officeScope
    const result = await service.createSalaryStructure(req.body as CreateSalaryStructureInput, officeScope)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'SalaryStructure', result.id, undefined, req.body)
    sendCreated(res, result)
  } catch (err) { handle(res, err) }
}

export async function list(req: Request, res: Response) {
  try {
    const officeScope = (req as OfficeScopedRequest).officeScope
    const { items, meta } = await service.listSalaryStructures(req.query as unknown as ListSalaryQuery, officeScope)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm@9 --filter @hr-system/api test -- salary.service.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/salary/salary.routes.ts apps/api/src/modules/salary/salary.service.ts apps/api/src/modules/salary/salary.controller.ts apps/api/src/modules/salary/salary.service.test.ts
git commit -m "feat(salary): open structure create/list to HR_MANAGER, add office scoping"
```

---

### Task 10: Full verification + update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (Project status section, lines 7 and 21)

- [ ] **Step 1: Run the full API test suite**

Run: `npx pnpm@9 --filter @hr-system/api test`
Expected: PASS — every test from Tasks 1–9 plus the pre-existing 4 tenant-isolation tests, all green.

- [ ] **Step 2: Run typecheck**

Run: `npx pnpm@9 --filter @hr-system/api typecheck`
Expected: PASS — no type errors from the new/changed signatures across `leave.service.ts`, `leave.controller.ts`, `attendance.service.ts`, `attendance.controller.ts`, `salary.service.ts`, `salary.controller.ts`.

- [ ] **Step 3: Run the full workspace test + typecheck**

Run: `npx pnpm@9 test && npx pnpm@9 typecheck`
Expected: PASS across all workspaces (`packages/utils`, `apps/api`).

- [ ] **Step 4: Update CLAUDE.md**

Replace line 7:

```
Last updated: 2026-07-06 — the 4-milestone security/completeness roadmap below is fully shipped. Keep this section current — see "Keeping this section current" below.
```

with:

```
Last updated: 2026-07-13 — role-management scoping hardening (below) shipped on top of the closed Milestones 1-4 roadmap. Keep this section current — see "Keeping this section current" below.
```

Insert a new bullet section directly after line 21 (the "Cleanup: removed dead..." bullet, before the blank line that precedes "**Remaining known gaps**"):

```
**Shipped after Milestones 1-4 — role-management scoping hardening:**
- Leave approval now resolves the correct approver via the applicant's real reporting chain (`Employee.reportingToId` for TEAM_LEAD-level chain steps, `Department.managerId` for DEPT_HEAD-level) instead of an arbitrary same-role user in the office, and `approve`/`reject`/`cancel-approve`/`cancel-reject` now require the caller to be the assigned `currentApproverId` (HR_MANAGER/SUPER_ADMIN still bypass this, office-scoped only) — see `resolveApproverForRole` in `leave.service.ts`.
- Fixed a real cross-office leak: `/leave/applications/pending`, `/approve`, `/reject`, `/cancel-approve`, `/cancel-reject` had no `officeScope` middleware at all, so an HR_MANAGER could see/act on pending leave applications from both offices.
- Attendance excuse review (`listPendingExcuses`/`reviewExcuse`) is now scoped to the reviewer's actual reports (TEAM_LEAD) or managed department(s) (DEPT_HEAD) instead of the whole office; `reviewExcuse` also gained a missing office-boundary check.
- Salary: fixed a buggy self-read check in `getForEmployee` that failed to block TEAM_LEAD/DEPT_HEAD from reading an arbitrary employee's salary (now `isSelfOrRole(..., HR_MANAGER)`); opened `POST/GET /salary` (structure create/list) to HR_MANAGER, previously SUPER_ADMIN-only, adding office scoping since it never needed it before.
- Extends the `apps/api` Vitest suite with new scoping regression tests across leave, attendance, and salary.
- Design rationale: `docs/superpowers/specs/2026-07-13-role-management-scoping-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record role-management scoping hardening in project status"
```
