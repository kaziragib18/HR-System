import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './attendance.controller'
import { checkInSchema, checkOutSchema, manualEntrySchema, bulkImportSchema, listAttendanceQuery } from './attendance.schemas'

export const attendanceRouter: RouterType = Router()

attendanceRouter.use(authenticate)

// Self-service — any authenticated user
attendanceRouter.post('/check-in', validate(checkInSchema), ctrl.checkIn)
attendanceRouter.post('/check-out', validate(checkOutSchema), ctrl.checkOut)
attendanceRouter.get('/today', ctrl.getToday)
attendanceRouter.get('/me', ctrl.getMyMonth)

// Manager/HR — list all + manual entry
attendanceRouter.get('/', officeScope, requireRole(UserRole.TEAM_LEAD), validate(listAttendanceQuery, 'query'), ctrl.list)
attendanceRouter.post('/', officeScope, requireRole(UserRole.HR_MANAGER), validate(manualEntrySchema), ctrl.manualEntry)
attendanceRouter.post('/bulk-import', requireRole(UserRole.HR_MANAGER), validate(bulkImportSchema), ctrl.bulkImport)
