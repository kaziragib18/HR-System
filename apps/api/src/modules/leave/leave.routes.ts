import { Router, type Router as RouterType } from 'express'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './leave.controller'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
import {
  applyLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  cancelLeaveSchema,
  rejectCancelLeaveSchema,
  updateCancelReasonSchema,
  leaveApplicationsQuery,
  leaveCalendarQuery,
} from './leave.schemas'

export const leaveRouter: RouterType = Router()

leaveRouter.use(authenticate)

// File attachment upload
leaveRouter.post('/attachments', upload.single('file'), ctrl.uploadAttachment)

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
leaveRouter.patch('/applications/:id/cancel', validate(cancelLeaveSchema), ctrl.cancel)
leaveRouter.patch('/applications/:id/cancel-reason', validate(updateCancelReasonSchema), ctrl.updateCancelReason)
leaveRouter.patch('/applications/:id/cancel-approve', requireRole(UserRole.TEAM_LEAD), ctrl.approveCancel)
leaveRouter.patch('/applications/:id/cancel-reject', requireRole(UserRole.TEAM_LEAD), validate(rejectCancelLeaveSchema), ctrl.rejectCancel)
