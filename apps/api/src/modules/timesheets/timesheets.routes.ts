import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './timesheets.controller'
import { rejectTimesheetSchema, approveTimesheetSchema, listTimesheetsQuery } from './timesheets.schemas'

export const timesheetsRouter: RouterType = Router()

timesheetsRouter.use(authenticate)

// Self-service — generate current week's timesheet from attendance
timesheetsRouter.post('/generate', ctrl.generate)

// My timesheets
timesheetsRouter.get('/me', validate(listTimesheetsQuery, 'query'), ctrl.listMine)
timesheetsRouter.get('/:id', ctrl.getOne)
timesheetsRouter.post('/:id/submit', ctrl.submit)

// Manager actions
timesheetsRouter.post('/:id/approve', requireRole(UserRole.TEAM_LEAD), validate(approveTimesheetSchema), ctrl.approve)
timesheetsRouter.post('/:id/reject', requireRole(UserRole.TEAM_LEAD), validate(rejectTimesheetSchema), ctrl.reject)

// Manager list view
timesheetsRouter.get('/', officeScope, requireRole(UserRole.TEAM_LEAD), validate(listTimesheetsQuery, 'query'), ctrl.listAll)
