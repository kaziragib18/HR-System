import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { departmentScope } from '../../middleware/department.middleware'
import { requireRole, requireExactRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './attendance.controller'
import { checkInSchema, checkOutSchema, manualEntrySchema, bulkImportSchema, listAttendanceQuery, calendarQuery, lateExcuseSchema, reviewExcuseSchema, requestAdjustmentSchema, reviewAdjustmentSchema } from './attendance.schemas'

export const attendanceRouter: RouterType = Router()

attendanceRouter.use(authenticate)

// Self-service — any authenticated user
attendanceRouter.post('/check-in', validate(checkInSchema), ctrl.checkIn)
attendanceRouter.post('/check-out', validate(checkOutSchema), ctrl.checkOut)
attendanceRouter.get('/today', ctrl.getToday)
attendanceRouter.get('/me/calendar', validate(calendarQuery, 'query'), ctrl.getMyCalendar)
attendanceRouter.get('/me', ctrl.getMyMonth)
attendanceRouter.patch('/me/:id/late-excuse', validate(lateExcuseSchema), ctrl.submitLateExcuse)
attendanceRouter.post('/me/adjustment-request', validate(requestAdjustmentSchema), ctrl.requestAdjustment)
attendanceRouter.patch('/me/adjustment-request/:id', validate(requestAdjustmentSchema), ctrl.updateAdjustmentRequest)

// Manager/HR — list all + manual entry + excuse review
// GET/list endpoints stay hierarchy-based (HR_MANAGER/SUPER_ADMIN can view office-wide,
// view-only); the two review/action endpoints use an explicit allow-list instead, since
// HR_MANAGER no longer has approval power despite outranking DEPT_MANAGER/DEPT_HEAD.
attendanceRouter.get('/late-excuses', officeScope, requireRole(UserRole.DEPT_MANAGER), ctrl.listPendingExcuses)
attendanceRouter.patch('/:id/review-excuse', officeScope, requireExactRole(UserRole.DEPT_MANAGER, UserRole.DEPT_HEAD, UserRole.SUPER_ADMIN), validate(reviewExcuseSchema), ctrl.reviewExcuse)
attendanceRouter.get('/adjustment-requests', officeScope, requireRole(UserRole.DEPT_MANAGER), ctrl.listPendingAdjustments)
attendanceRouter.patch('/:id/review-adjustment', officeScope, requireExactRole(UserRole.DEPT_MANAGER, UserRole.DEPT_HEAD, UserRole.SUPER_ADMIN), validate(reviewAdjustmentSchema), ctrl.reviewAdjustment)
attendanceRouter.get('/', officeScope, departmentScope, requireRole(UserRole.DEPT_MANAGER), validate(listAttendanceQuery, 'query'), ctrl.list)
// DEPT_HEAD/DEPT_MANAGER can now correct attendance too, but only for their
// own department — departmentScope forces/validates that server-side (see
// manualEntry's officeScope/departmentScope checks in attendance.service.ts).
attendanceRouter.post('/', officeScope, departmentScope, requireRole(UserRole.DEPT_MANAGER), validate(manualEntrySchema), ctrl.manualEntry)
attendanceRouter.post('/bulk-import', requireRole(UserRole.HR_MANAGER), validate(bulkImportSchema), ctrl.bulkImport)
