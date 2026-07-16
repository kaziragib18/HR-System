import { Router, type Router as RouterType } from 'express'
import * as controller from './departments.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignManagerSchema,
  appointRoleSchema,
  dismissRoleSchema,
} from './departments.schemas'

const router: RouterType = Router()

router.use(authenticate, officeScope)

const HR = requireRole(UserRole.HR_MANAGER)

// Readable by any authenticated user
router.get('/', controller.list)
router.get('/tree', controller.tree)
router.get('/:id', controller.getById)
router.get('/:id/employees', controller.members)

// Mutations (HR+)
router.post('/', HR, validate(createDepartmentSchema), controller.create)
router.patch('/:id', HR, validate(updateDepartmentSchema), controller.update)
router.delete('/:id', HR, controller.remove)
router.patch('/:id/manager', HR, validate(assignManagerSchema), controller.assignManager)
router.delete('/:id/manager', HR, controller.removeManager)
// Appoint/remove a department Head or Manager — also switches the person's role.
router.patch('/:id/appoint', HR, validate(appointRoleSchema), controller.appoint)
router.patch('/:id/dismiss', HR, validate(dismissRoleSchema), controller.dismiss)

export { router as departmentsRouter }
