import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './payroll.controller'
import { createPayrollRunSchema, listPayrollRunsQuery, myPayslipsQuery } from './payroll.schemas'

export const payrollRouter: RouterType = Router()

payrollRouter.use(authenticate)

// Employee self-service
payrollRouter.get('/me', validate(myPayslipsQuery, 'query'), ctrl.listMyPayslips)
payrollRouter.get('/me/:runId', ctrl.getMyPayslip)

// HR management
payrollRouter.post('/runs', requireRole(UserRole.SUPER_ADMIN), validate(createPayrollRunSchema), ctrl.create)
payrollRouter.get('/runs', officeScope, requireRole(UserRole.SUPER_ADMIN), validate(listPayrollRunsQuery, 'query'), ctrl.list)
payrollRouter.get('/runs/:id', requireRole(UserRole.SUPER_ADMIN), ctrl.getOne)
payrollRouter.post('/runs/:id/process', requireRole(UserRole.SUPER_ADMIN), ctrl.process)
payrollRouter.post('/runs/:id/approve', requireRole(UserRole.SUPER_ADMIN), ctrl.approve)
payrollRouter.post('/runs/:id/mark-paid', requireRole(UserRole.SUPER_ADMIN), ctrl.paid)
