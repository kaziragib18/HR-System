import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import * as controller from './documents.controller'
import { listDocumentsQuerySchema, createDocumentBodySchema } from './documents.schemas'

const router: RouterType = Router()

router.use(authenticate)

router.get('/', validate(listDocumentsQuerySchema, 'query'), controller.list)
router.post('/', controller.upload.single('file'), validate(createDocumentBodySchema), controller.create)
router.get('/:id/download-url', controller.downloadUrl)
router.delete('/:id', controller.remove)

export { router as documentsRouter }
