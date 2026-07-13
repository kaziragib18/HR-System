import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
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
attendanceRouter.get('/late-excuses', officeScope, requireRole(UserRole.TEAM_LEAD), ctrl.listPendingExcuses)
attendanceRouter.patch('/:id/review-excuse', officeScope, requireRole(UserRole.TEAM_LEAD), validate(reviewExcuseSchema), ctrl.reviewExcuse)
attendanceRouter.get('/adjustment-requests', officeScope, requireRole(UserRole.TEAM_LEAD), ctrl.listPendingAdjustments)
attendanceRouter.patch('/:id/review-adjustment', officeScope, requireRole(UserRole.TEAM_LEAD), validate(reviewAdjustmentSchema), ctrl.reviewAdjustment)
attendanceRouter.get('/', officeScope, requireRole(UserRole.TEAM_LEAD), validate(listAttendanceQuery, 'query'), ctrl.list)
attendanceRouter.post('/', officeScope, requireRole(UserRole.HR_MANAGER), validate(manualEntrySchema), ctrl.manualEntry)
attendanceRouter.post('/bulk-import', requireRole(UserRole.HR_MANAGER), validate(bulkImportSchema), ctrl.bulkImport)
