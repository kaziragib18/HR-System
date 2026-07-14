import { Router, type Router as RouterType } from 'express'
import multer from 'multer'
import * as controller from './announcements.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import { createAnnouncementSchema, updateAnnouncementSchema } from './announcements.schemas'

const router: RouterType = Router()
router.use(authenticate, officeScope)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// Readable by any authenticated user
router.get('/feed', controller.getFeed)

// Mutations (HR_MANAGER+; author-or-SUPER_ADMIN check for update/delete lives in the service)
router.post(
  '/',
  requireRole(UserRole.HR_MANAGER),
  upload.single('attachment'),
  validate(createAnnouncementSchema),
  controller.create
)
router.patch('/:id', validate(updateAnnouncementSchema), controller.update)
router.delete('/:id', controller.remove)

export { router as announcementsRouter }
