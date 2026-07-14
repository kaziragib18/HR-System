# Role & Permission Configuration Settings Tab — Design

## Context

The Settings area (`apps/web/src/app/(dashboard)/settings/`) currently has two tabs — Profile and Security — both open to every authenticated user. There is no page anywhere in the app that lists all employees alongside their system role, and, more importantly, **no existing mechanism at all to change an employee's role once created**: `User.role` is only ever written at employee-creation time (`employees.service.ts`'s `createEmployee`); `updateEmployee` never touches it, and the `PATCH /employees/:id` schema's stray `role` field is dead code that would throw a Prisma error if ever sent (confirmed by direct code inspection, not assumption).

This adds a SUPER_ADMIN-only "Roles & Permissions" tab: a searchable list of every employee with their current role and a control to change it, plus a static reference table of what each of the 5 fixed roles (`SUPER_ADMIN > HR_MANAGER > DEPT_HEAD > TEAM_LEAD > EMPLOYEE`) can actually do — reflecting the real `requireRole(...)` gates already in the route files, not a new independently-configurable permission system. This app has no `Permission` model and authorization is entirely role-hierarchy-based (`apps/api/src/middleware/rbac.middleware.ts`); building a granular per-user permission system would mean rewiring every route in the app and is explicitly out of scope.

## Decisions

- **Permission display**: static reference matrix (role × capability), not editable, not stored in the database — a documentation surface over the real middleware gates.
- **Safety guards on role changes**: block a SUPER_ADMIN from changing their own role; block changing the role of the last remaining active SUPER_ADMIN.
- **List**: a dedicated table built for this tab, not an extension of the existing (already complex, inline-edit-heavy) Employees page — but reusing the existing `GET /employees` endpoint's data, not a parallel backend route.
- **Out of scope**: cascading updates when a demoted person is still someone's `Department.managerId` or `Employee.reportingToId` — noted as a known limitation, not solved here.

## Backend

**`apps/api/src/modules/employees/employees.schemas.ts`** — add:
```ts
export const updateEmployeeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
})
```

**`apps/api/src/modules/employees/employees.service.ts`** — add `updateEmployeeRole`:
```ts
export async function updateEmployeeRole(employeeId: string, newRole: UserRole, actorEmployeeId: string) {
  if (employeeId === actorEmployeeId) {
    throw new EmployeeError('You cannot change your own role', 400)
  }
  const user = await prisma.user.findUnique({ where: { employeeId }, select: { role: true, isActive: true } })
  if (!user) throw new EmployeeError('Employee not found', 404)

  if (user.role === UserRole.SUPER_ADMIN && newRole !== UserRole.SUPER_ADMIN) {
    const otherSuperAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, isActive: true, employeeId: { not: employeeId } },
    })
    if (otherSuperAdmins === 0) {
      throw new EmployeeError('Cannot remove the last Super Admin', 400)
    }
  }

  return prisma.user.update({ where: { employeeId }, data: { role: newRole } })
}
```
`EmployeeError` is `constructor(message: string, public status = 400)` — confirmed in `employees.service.ts`, matches the calls above exactly.

Also extend `listEmployees`'s `listInclude` (currently `department`, `jobTitle`, `jobGrade`, `reportingTo`, `office` — no `user` relation) with `user: { select: { role: true, isActive: true } }`, and add `role: string` / `isActive: boolean` to the shared `EmployeeListItem` type in `packages/types/src/employee.ts`.

**`apps/api/src/modules/employees/employees.controller.ts`** — add `updateRole` controller: calls the service with `req.params.id`, `req.body.role`, `req.user.employeeId` (actor), then `auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'User', req.params.id, undefined, req.body)` — matching the exact shape already used for e.g. `reject` in `leave.controller.ts` (resource + id + `undefined` oldValue + `req.body` as newValue), not a bespoke old/new-role capture.

**`apps/api/src/modules/employees/employees.routes.ts`** — add:
```ts
employeesRouter.patch('/:id/role', requireRole(UserRole.SUPER_ADMIN), validate(updateEmployeeRoleSchema), controller.updateRole)
```

## Frontend

**Lift the shared role-badge primitive**: move `RolePill` + its `fmtRole` helper out of `apps/web/src/app/(dashboard)/approvals/page.tsx` (currently page-local) into `apps/web/src/components/ui/primitives.tsx`, and update `approvals/page.tsx` to import from there instead of defining its own copy.

**`apps/web/src/app/(dashboard)/settings/layout.tsx`** — add a third tab entry, `hidden` unless `user.role === UserRole.SUPER_ADMIN` (the `Tabs` component at `components/ui/tabs.tsx` already filters on a per-item `hidden` boolean — no component change needed).

**New page**: `apps/web/src/app/(dashboard)/settings/roles/page.tsx`:
- Page-level `if (user?.role !== UserRole.SUPER_ADMIN) return <Access restricted>` guard (same pattern as `/salary`, `/payroll`, `/payroll/[id]`), in case of direct navigation.
- **Permission matrix section**: a static array of `{ capability: string; roles: UserRole[] }` (which roles can do it) rendered as a table, ~12 rows covering: self-service actions (all 5 roles), department/holiday/job-grade read (all 5 — these are open reads with no `requireRole` today, confirmed in `departments.routes.ts`/`holidays.routes.ts`/`job-grades.routes.ts`), employee directory read (TEAM_LEAD+), approving leave/excuse/adjustment requests (TEAM_LEAD+), creating/editing employees/departments/job-grades/holidays (HR_MANAGER+), managing salary structures (HR_MANAGER+), payroll run lifecycle (SUPER_ADMIN only), company profile/compliance docs (SUPER_ADMIN only), cross-office visibility (SUPER_ADMIN only), assigning roles (SUPER_ADMIN only — this feature).
- **People list section**: reuses `useEmployees` (existing hook, existing search/office/department params) with a new `role`/`isActive` field now present on each item; a dedicated table (Avatar+Name, Employee ID, Office, Department, `RolePill`, "Change Role" button) — a fresh, simple render, not a modification of `employees/page.tsx`'s table.
- **Change-role modal**: click "Change Role" → modal with a `<select>` of the 5 roles (defaulting to current) → Confirm button → calls the new mutation → closes on success, surfaces the backend's 400 messages (self-change / last-super-admin) as an inline error in the modal, matching the existing `ReasonModal`/`ConfirmModal` error-handling convention on other pages.

**`apps/web/src/lib/api/hooks/useEmployees.ts`** — add:
```ts
export function useUpdateEmployeeRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { data } = await apiClient.patch(`/employees/${id}/role`, { role })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
```

## Testing

Backend TDD (new test file `employees.service.role.test.ts`, Prisma-mocked, matching the established pattern in this codebase):
- Successful role change updates the user and the audit call fires with old/new role.
- Self-role-change is rejected with the expected error/status.
- Demoting the last active SUPER_ADMIN is rejected; demoting one of *two* active SUPER_ADMINs succeeds.
- Target employee not found → 404.

Frontend: typecheck + live verification via curl against the running dev server (no test infra exists for pages in this repo today — matches the existing, already-documented gap, not a new decision made here).

## Verification

1. `npx pnpm@9 typecheck && npx pnpm@9 test` clean across the workspace.
2. As SUPER_ADMIN: open Settings → Roles & Permissions, confirm the matrix renders and the people list loads with correct roles; change a test employee's role and confirm it persists (re-fetch) and an audit log row was written.
3. Confirm a non-SUPER_ADMIN never sees the tab (hidden) and gets 403 if hitting the route/API directly.
4. Confirm self-role-change and last-super-admin-demotion are both rejected with a clear message in the modal.
