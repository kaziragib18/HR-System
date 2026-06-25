import { Router, type Router as RouterType } from 'express'
import * as controller from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  bankInfoSchema,
  listEmployeesQuerySchema,
} from './employees.schemas'

const router: RouterType = Router()

router.use(authenticate, officeScope)

const HR = requireRole(UserRole.HR_MANAGER) // HR_MANAGER and above
const MANAGER = requireRole(UserRole.TEAM_LEAD) // managers and above

// Directory is readable by everyone
router.get('/directory', controller.directory)

// Listing / reading
router.get('/', MANAGER, validate(listEmployeesQuerySchema, 'query'), controller.list)
router.get('/:id', MANAGER, controller.getById)
router.get('/:id/org-chart', controller.orgChart)

// Mutations (HR+)
router.post('/', HR, validate(createEmployeeSchema), controller.create)
router.patch('/:id', HR, validate(updateEmployeeSchema), controller.update)
router.delete('/:id', HR, controller.remove)

// Bank info (HR+ only — sensitive)
router.get('/:id/bank-info', HR, controller.getBankInfo)
router.put('/:id/bank-info', HR, validate(bankInfoSchema), controller.putBankInfo)

export { router as employeesRouter }
