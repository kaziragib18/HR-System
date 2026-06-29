import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import * as ctrl from './salary.controller'
import { createSalaryStructureSchema, listSalaryQuery } from './salary.schemas'

export const salaryRouter: RouterType = Router()

salaryRouter.use(authenticate)

salaryRouter.post('/', requireRole(UserRole.SUPER_ADMIN), validate(createSalaryStructureSchema), ctrl.create)
salaryRouter.get('/', requireRole(UserRole.SUPER_ADMIN), validate(listSalaryQuery, 'query'), ctrl.list)
salaryRouter.get('/:employeeId', ctrl.getForEmployee)
