import type { Request, Response } from 'express'
import multer from 'multer'
import * as service from './profile.service'
import { EmployeeError } from './employees.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type {
  CreateWorkExperienceInput,
  UpdateWorkExperienceInput,
  CreateEducationInput,
  UpdateEducationInput,
  CreateSkillInput,
  UpdateSkillInput,
  CreateCertificationInput,
  UpdateCertificationInput,
  CreateIdentificationInput,
  UpdateIdentificationInput,
} from './profile.schemas'

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function scope(req: Request): string | undefined {
  return (req as OfficeScopedRequest).officeScope
}

function handle(res: Response, err: unknown) {
  if (err instanceof EmployeeError) {
    sendError(res, err.message, err.status)
    return
  }
  throw err
}

function fileInput(req: Request) {
  return req.file
    ? {
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        originalName: req.file.originalname,
      }
    : undefined
}

// ─── Work Experience ────────────────────────────────────────────────────────

export async function listWorkExperience(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listWorkExperience(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function createWorkExperience(req: Request, res: Response) {
  try {
    sendCreated(res, await service.createWorkExperience(req.params.id, scope(req), req.body as CreateWorkExperienceInput))
  } catch (err) {
    handle(res, err)
  }
}

export async function updateWorkExperience(req: Request, res: Response) {
  try {
    sendSuccess(
      res,
      await service.updateWorkExperience(req.params.id, scope(req), req.params.weId, req.body as UpdateWorkExperienceInput)
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function deleteWorkExperience(req: Request, res: Response) {
  try {
    await service.deleteWorkExperience(req.params.id, scope(req), req.params.weId)
    sendSuccess(res, { message: 'Work experience removed' })
  } catch (err) {
    handle(res, err)
  }
}

// ─── Education ──────────────────────────────────────────────────────────────

export async function listEducation(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listEducation(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function createEducation(req: Request, res: Response) {
  try {
    sendCreated(res, await service.createEducation(req.params.id, scope(req), req.body as CreateEducationInput))
  } catch (err) {
    handle(res, err)
  }
}

export async function updateEducation(req: Request, res: Response) {
  try {
    sendSuccess(
      res,
      await service.updateEducation(req.params.id, scope(req), req.params.eduId, req.body as UpdateEducationInput)
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function deleteEducation(req: Request, res: Response) {
  try {
    await service.deleteEducation(req.params.id, scope(req), req.params.eduId)
    sendSuccess(res, { message: 'Education entry removed' })
  } catch (err) {
    handle(res, err)
  }
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export async function listSkills(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listSkills(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function createSkill(req: Request, res: Response) {
  try {
    sendCreated(res, await service.createSkill(req.params.id, scope(req), req.body as CreateSkillInput))
  } catch (err) {
    handle(res, err)
  }
}

export async function updateSkill(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.updateSkill(req.params.id, scope(req), req.params.skillId, req.body as UpdateSkillInput))
  } catch (err) {
    handle(res, err)
  }
}

export async function deleteSkill(req: Request, res: Response) {
  try {
    await service.deleteSkill(req.params.id, scope(req), req.params.skillId)
    sendSuccess(res, { message: 'Skill removed' })
  } catch (err) {
    handle(res, err)
  }
}

// ─── Certifications (Training) ───────────────────────────────────────────────

export async function listCertifications(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listCertifications(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function createCertification(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    sendCreated(
      res,
      await service.createCertification(
        req.params.id,
        scope(req),
        req.body as CreateCertificationInput,
        fileInput(req),
        authReq.user.employeeId
      )
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function updateCertification(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    sendSuccess(
      res,
      await service.updateCertification(
        req.params.id,
        scope(req),
        req.params.certId,
        req.body as UpdateCertificationInput,
        fileInput(req),
        authReq.user.employeeId
      )
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function deleteCertification(req: Request, res: Response) {
  try {
    await service.deleteCertification(req.params.id, scope(req), req.params.certId)
    sendSuccess(res, { message: 'Certification removed' })
  } catch (err) {
    handle(res, err)
  }
}

// ─── Identification ───────────────────────────────────────────────────────────

export async function listIdentifications(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listIdentifications(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function createIdentification(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    sendCreated(
      res,
      await service.createIdentification(
        req.params.id,
        scope(req),
        req.body as CreateIdentificationInput,
        fileInput(req),
        authReq.user.employeeId
      )
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function updateIdentification(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    sendSuccess(
      res,
      await service.updateIdentification(
        req.params.id,
        scope(req),
        req.params.idId,
        req.body as UpdateIdentificationInput,
        fileInput(req),
        authReq.user.employeeId
      )
    )
  } catch (err) {
    handle(res, err)
  }
}

export async function deleteIdentification(req: Request, res: Response) {
  try {
    await service.deleteIdentification(req.params.id, scope(req), req.params.idId)
    sendSuccess(res, { message: 'Identification record removed' })
  } catch (err) {
    handle(res, err)
  }
}
