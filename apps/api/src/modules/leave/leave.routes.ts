import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './leave.controller'
import {
  applyLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  leaveApplicationsQuery,
  leaveCalendarQuery,
} from './leave.schemas'

export const leaveRouter: RouterType = Router()

leaveRouter.use(authenticate)

// Leave types & balances — any authenticated user
leaveRouter.get('/types', ctrl.getTypes)
leaveRouter.get('/balances', ctrl.getBalances)
leaveRouter.get('/balances/:employeeId', requireRole(UserRole.TEAM_LEAD), ctrl.getBalances)
leaveRouter.get('/calendar', officeScope, validate(leaveCalendarQuery, 'query'), ctrl.calendar)

// Applications
leaveRouter.post('/applications', validate(applyLeaveSchema), ctrl.apply)
leaveRouter.get('/applications', officeScope, validate(leaveApplicationsQuery, 'query'), ctrl.getApplications)
leaveRouter.get('/applications/pending', requireRole(UserRole.TEAM_LEAD), ctrl.getPending)
leaveRouter.get('/applications/:id', ctrl.getApplication)
leaveRouter.patch('/applications/:id/approve', requireRole(UserRole.TEAM_LEAD), validate(approveLeaveSchema), ctrl.approve)
leaveRouter.patch('/applications/:id/reject', requireRole(UserRole.TEAM_LEAD), validate(rejectLeaveSchema), ctrl.reject)
leaveRouter.patch('/applications/:id/cancel', ctrl.cancel)
