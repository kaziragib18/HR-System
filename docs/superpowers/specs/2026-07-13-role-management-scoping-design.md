# Role management scoping fixes — design

## Context

A review of the current RBAC implementation (`apps/api/src/middleware/rbac.middleware.ts` + `office.middleware.ts`) found that role checks are hierarchy-only (`SUPER_ADMIN(5) > HR_MANAGER(4) > DEPT_HEAD(3) > TEAM_LEAD(2) > EMPLOYEE(1)`) with no resource-level scoping. Three concrete gaps were identified and confirmed by reading the actual service/controller code:

1. **Leave approval** has no approver-identity check — any TEAM_LEAD+ can approve/reject any leave application in the system.
2. **Attendance excuse review** is scoped only to office, not to the reviewing TEAM_LEAD's own reports.
3. **Salary single-employee read** has a buggy self-check that fails to block TEAM_LEAD/DEPT_HEAD from viewing an arbitrary employee's salary.

While designing the fix for gap 1 and gap 2, two additional **cross-office tenant-isolation bugs** were found (not hierarchy issues — actual office-boundary leaks):

- `GET /leave/applications/pending`, `PATCH /applications/:id/approve`, `/reject`, `/cancel-approve`, `/cancel-reject` have no `officeScope` middleware at all. An HR_MANAGER (who should be confined to their own office) currently sees and can act on pending leave applications from **both** offices.
- `reviewExcuse` (the attendance excuse approve/reject action) has no office check whatsoever — a TEAM_LEAD could review an excuse belonging to an employee in the other office.

Per user decision, this pass fixes the 3 original gaps plus these 2 newly-found bugs (they surface directly from implementing the 3 gaps correctly), but does **not** expand into two related-but-distinct items also spotted during investigation: `GET /leave/balances/:employeeId` and the manager view of `GET /leave/applications` have the same "any TEAM_LEAD+ sees the whole office" shape, but are left untouched for a future pass.

Intended outcome: authorization checks reflect actual reporting structure (`Employee.reportingToId`, `Department.managerId`), not just role rank, while HR_MANAGER and SUPER_ADMIN retain their existing office-wide / global reach by design.

## Mechanism

Resolve scope inline using existing relational fields — no schema changes:

- **TEAM_LEAD-level scope** = employees where `Employee.reportingToId` equals the caller's `employeeId`.
- **DEPT_HEAD-level scope** = employees whose `departmentId` is a department where `Department.managerId` equals the caller's `employeeId`.
- **HR_MANAGER-level scope** = unchanged, the caller's own office (existing `officeScope` middleware).
- **SUPER_ADMIN-level scope** = unchanged, unbounded.

A small shared resolver, `resolveApproverForRole(role, employeeId, officeId)`, centralizes "who is the correct approver at this chain level for this employee" and replaces the current `prisma.user.findFirst({ role, officeId })` pattern (which picks an arbitrary user with the right role, not the applicant's actual manager). For HR_MANAGER/SUPER_ADMIN-level chain steps, the resolver keeps today's "any user with that role in office" behavior unchanged, since those roles are office-wide by design, not tied to a specific reporting relationship. If a TEAM_LEAD/DEPT_HEAD-level resolution finds no manager (`reportingToId`/`Department.managerId` unset), it returns `null` — same graceful-degradation behavior the code already has today for missing approvers (the application stays pending with no `currentApproverId` until manually re-routed).

"Admin" for the purposes of the identity-check bypass below means SUPER_ADMIN or HR_MANAGER specifically — matching the existing `isAdmin` distinction already used in `pendingForApprover` (`leave.service.ts`), not the broader `MANAGER_ROLES` list in the controller (which also includes DEPT_HEAD/TEAM_LEAD).

Two other design approaches were considered and rejected: a central `requireScope(...)` middleware (bigger refactor than this pass warrants) and a precomputed permission cache (solves a performance problem this system doesn't have at its current scale).

## Per-role summary

| Role | Change |
|---|---|
| SUPER_ADMIN | No change — already correctly unbounded everywhere checked. |
| HR_MANAGER | Fix cross-office leaks in leave pending/approve/reject/cancel-approve/cancel-reject routes (add missing `officeScope`). Open `POST /salary` and `GET /salary` (currently SUPER_ADMIN-only) to HR_MANAGER, adding office filtering since these endpoints never needed it before. |
| DEPT_HEAD | Leave approval-chain steps at DEPT_HEAD level resolve to the applicant's actual `Department.managerId`. Attendance excuse list/review scoped to the DEPT_HEAD's own department(s). Loses ability to read an arbitrary employee's salary (now self-or-HR_MANAGER+ only). |
| TEAM_LEAD | Leave approval-chain steps at TEAM_LEAD level resolve to the applicant's actual `Employee.reportingToId`; approve/reject/cancel-approve/cancel-reject require caller to match the assigned `currentApproverId`. Attendance excuse list/review scoped to direct reports. Loses ability to read an arbitrary employee's salary. |
| EMPLOYEE | No behavioral change — self-service actions (apply for leave, submit excuse, view own salary) are unaffected. |

## Component changes

**`apps/api/src/modules/leave/`**
- `leave.service.ts`: add `resolveApproverForRole` helper; use it in `applyLeave` (initial approver), `approveLeave` (forwarding to next level), and `cancelLeave` (fallback approver when `currentApproverId` is null). Add office-match check (`app.employee.officeId !== officeScope → 404`) and identity check (`approvingEmployeeId !== app.currentApproverId → 403` for non-admin roles) to `approveLeave`, `rejectLeave`, `approveCancelLeave`, `rejectCancelLeave`.
- `leave.controller.ts`: thread `officeScope` and caller role/employeeId into the above service calls.
- `leave.routes.ts`: add `officeScope` middleware to `/applications/pending`, `/applications/:id/approve`, `/reject`, `/cancel-approve`, `/cancel-reject` (currently missing).

**`apps/api/src/modules/attendance/`**
- `attendance.service.ts`: `listPendingExcuses` and `reviewExcuse` take the caller's role + employeeId; apply reportingToId/Department.managerId filtering for TEAM_LEAD/DEPT_HEAD; add the missing office-match check to `reviewExcuse`.
- `attendance.controller.ts`: pass caller role/employeeId through.

**`apps/api/src/modules/salary/`**
- `salary.routes.ts`: `POST /` and `GET /` change from `requireRole(SUPER_ADMIN)` to `requireRole(HR_MANAGER)`.
- `salary.service.ts`: `createSalaryStructure` validates the target employee's/job-grade's `officeId` against the caller's office scope; `listSalaryStructures` filters by it (via employee or job-grade office match).
- `salary.controller.ts`: thread `officeScope` into create/list; replace `getForEmployee`'s hand-rolled `role === 'EMPLOYEE'` check with `isSelfOrRole(user, employeeId, UserRole.HR_MANAGER)`.

## Testing

Extend the existing Prisma-mocked supertest pattern (`apps/api/src/__tests__/tenant-isolation.test.ts`) with scoping regression cases:

- Leave: TEAM_LEAD who is not the applicant's `reportingToId` gets 403 on approve/reject; DEPT_HEAD who doesn't head the applicant's department gets 403; HR_MANAGER from the other office gets 404; approver resolution assigns the applicant's real manager, not an arbitrary same-role user.
- Attendance: TEAM_LEAD only sees/reviews direct reports' excuses; DEPT_HEAD sees/reviews department-wide; cross-office review attempt is rejected.
- Salary: TEAM_LEAD/DEPT_HEAD can no longer read an arbitrary employee's salary; HR_MANAGER can create/list within their own office only, not the other office.

## Out of scope (follow-up candidates)

- `GET /leave/balances/:employeeId` — any TEAM_LEAD+ can view any employee's balance in-office.
- `GET /leave/applications` (manager view) — any TEAM_LEAD+ sees all applications office-wide, not just their reports/department.

Both have the identical shape to the fixes above and could reuse the same resolver in a later pass.
