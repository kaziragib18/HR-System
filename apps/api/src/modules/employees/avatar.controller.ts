import type { Request, Response } from 'express'
import multer from 'multer'
import { prisma } from '../../config/prisma'
import { supabase } from '../../config/supabase'
import { sendSuccess, sendError } from '../../utils/response'
import { isAllowedImage, ALLOWED_IMAGE_MESSAGE } from '../../utils/upload'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import { getEmployee, EmployeeError } from './employees.service'

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

export async function uploadAvatar(req: Request, res: Response) {
  try {
    const r = req as OfficeScopedRequest
    const employee = await getEmployee(req.params.id, r.officeScope)

    if (!req.file) {
      sendError(res, 'avatar file is required', 400)
      return
    }
    if (!isAllowedImage(req.file.mimetype)) {
      sendError(res, ALLOWED_IMAGE_MESSAGE, 400)
      return
    }

    const ext = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'png'
    const storagePath = `employees/${employee.id}_${Date.now()}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('avatars')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true })

    if (storageErr) {
      sendError(res, `Avatar upload failed: ${storageErr.message}`, 500)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(storagePath)

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: { avatarUrl: publicUrl },
    })

    sendSuccess(res, { avatarUrl: updated.avatarUrl })
  } catch (err) {
    if (err instanceof EmployeeError) {
      sendError(res, err.message, err.status)
      return
    }
    throw err
  }
}
