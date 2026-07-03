import { Router, type Request, type Response, type Router as RouterType } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../../config/prisma'
import { supabase } from '../../config/supabase'
import { authenticate, type AuthRequest } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendCreated, sendNotFound } from '../../utils/response'
import { UserRole } from '@hr-system/types'

const router: RouterType = Router()
router.use(authenticate)

const SA = requireRole(UserRole.SUPER_ADMIN)

// multer: hold file in memory, max 20 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const updateOfficeSchema = z.object({
  name:    z.string().min(1).optional(),
  address: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
})

// ─── Offices ──────────────────────────────────────────────────────────────────

router.get('/offices', async (_req: Request, res: Response) => {
  const offices = await prisma.office.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })
  sendSuccess(res, offices)
})

router.patch('/offices/:id', SA, validate(updateOfficeSchema), async (req: Request, res: Response) => {
  const office = await prisma.office.findUnique({ where: { id: req.params.id } })
  if (!office) return sendNotFound(res, 'Office not found')
  const updated = await prisma.office.update({ where: { id: req.params.id }, data: req.body })
  sendSuccess(res, updated)
})

// Upload logo image for an office (Super Admin only)
router.post(
  '/offices/:id/logo',
  SA,
  upload.single('logo'),
  async (req: Request, res: Response) => {
    try {
      const office = await prisma.office.findUnique({ where: { id: req.params.id } })
      if (!office) return sendNotFound(res, 'Office not found')
      if (!req.file) return res.status(400).json({ success: false, error: 'logo file is required' })

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'png'
      const storagePath = `logos/${office.code.toLowerCase()}_${Date.now()}.${ext}`

      const { error: storageErr } = await supabase.storage
        .from('avatars')
        .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true })

      if (storageErr) {
        return res.status(500).json({ success: false, error: `Logo upload failed: ${storageErr.message}` })
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(storagePath)

      const updated = await prisma.office.update({
        where: { id: req.params.id },
        data: { logoUrl: publicUrl },
      })
      sendSuccess(res, updated)
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: `Logo upload failed: ${(err as Error).message}` })
    }
  },
)

// ─── Compliance Documents ─────────────────────────────────────────────────────

router.get('/compliance-docs', async (_req: Request, res: Response) => {
  const docs = await prisma.complianceDoc.findMany({
    where: { isActive: true },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  sendSuccess(res, docs)
})

// Upload file + create record in one request (Super Admin only)
router.post(
  '/compliance-docs',
  SA,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest
      const { title, description } = req.body as { title?: string; description?: string }

      if (!title?.trim()) {
        return res.status(400).json({ success: false, error: 'title is required' })
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'file is required' })
      }

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `compliance-docs/${Date.now()}_${safeName}`
      const contentType = req.file.mimetype || 'application/octet-stream'

      // Upload to Supabase Storage via service role (bypasses RLS / CORS)
      const { error: storageErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, req.file.buffer, { contentType, upsert: false })

      if (storageErr) {
        return res.status(500).json({ success: false, error: `Storage upload failed: ${storageErr.message}` })
      }

      const doc = await prisma.complianceDoc.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          storagePath,
          mimeType: contentType,
          fileSize: req.file.size,
          uploadedById: authReq.user.employeeId,
        },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      })

      sendCreated(res, doc)
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: `Upload failed: ${(err as Error).message}` })
    }
  },
)

// Get signed download URL
router.get('/compliance-docs/:id/download-url', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.complianceDoc.findUnique({ where: { id: req.params.id } })
    if (!doc || !doc.isActive) return sendNotFound(res, 'Document not found')
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storagePath, 3600)
    if (error || !data) {
      return res.status(500).json({ success: false, error: `Failed to create download URL: ${error?.message}` })
    }
    sendSuccess(res, { downloadUrl: data.signedUrl, title: doc.title })
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: `Download URL failed: ${(err as Error).message}` })
  }
})

// Soft-delete (Super Admin only)
router.delete('/compliance-docs/:id', SA, async (req: Request, res: Response) => {
  const doc = await prisma.complianceDoc.findUnique({ where: { id: req.params.id } })
  if (!doc) return sendNotFound(res, 'Document not found')
  await prisma.complianceDoc.update({ where: { id: req.params.id }, data: { isActive: false } })
  sendSuccess(res, null)
})

export { router as companyRouter }
