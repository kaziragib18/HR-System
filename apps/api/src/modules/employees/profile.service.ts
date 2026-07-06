import { prisma } from '../../config/prisma'
import { DocumentType } from '@hr-system/types'
import { getEmployee, EmployeeError } from './employees.service'
import { uploadDocument, deactivateDocument } from '../documents/documents.service'
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

interface FileInput {
  buffer: Buffer
  mimeType: string
  sizeBytes: number
  originalName: string
}

const documentSelect = {
  id: true,
  name: true,
  type: true,
  fileMime: true,
  fileSizeBytes: true,
  createdAt: true,
} as const

// ─── Work Experience ────────────────────────────────────────────────────────

export async function listWorkExperience(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.workExperience.findMany({ where: { employeeId }, orderBy: { startDate: 'desc' } })
}

export async function createWorkExperience(
  employeeId: string,
  officeScope: string | undefined,
  data: CreateWorkExperienceInput
) {
  await getEmployee(employeeId, officeScope)
  return prisma.workExperience.create({
    data: {
      employeeId,
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function updateWorkExperience(
  employeeId: string,
  officeScope: string | undefined,
  id: string,
  data: UpdateWorkExperienceInput
) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.workExperience.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Work experience not found', 404)
  return prisma.workExperience.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function deleteWorkExperience(employeeId: string, officeScope: string | undefined, id: string) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.workExperience.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Work experience not found', 404)
  await prisma.workExperience.delete({ where: { id } })
}

// ─── Education ──────────────────────────────────────────────────────────────

export async function listEducation(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.education.findMany({ where: { employeeId }, orderBy: { startDate: 'desc' } })
}

export async function createEducation(employeeId: string, officeScope: string | undefined, data: CreateEducationInput) {
  await getEmployee(employeeId, officeScope)
  return prisma.education.create({
    data: {
      employeeId,
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function updateEducation(
  employeeId: string,
  officeScope: string | undefined,
  id: string,
  data: UpdateEducationInput
) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.education.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Education entry not found', 404)
  return prisma.education.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function deleteEducation(employeeId: string, officeScope: string | undefined, id: string) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.education.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Education entry not found', 404)
  await prisma.education.delete({ where: { id } })
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export async function listSkills(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.employeeSkill.findMany({ where: { employeeId }, orderBy: { name: 'asc' } })
}

export async function createSkill(employeeId: string, officeScope: string | undefined, data: CreateSkillInput) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.employeeSkill.findFirst({
    where: { employeeId, name: { equals: data.name, mode: 'insensitive' } },
  })
  if (existing) throw new EmployeeError('This skill already exists for this employee', 409)
  return prisma.employeeSkill.create({ data: { employeeId, ...data } })
}

export async function updateSkill(
  employeeId: string,
  officeScope: string | undefined,
  id: string,
  data: UpdateSkillInput
) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.employeeSkill.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Skill not found', 404)
  return prisma.employeeSkill.update({ where: { id }, data })
}

export async function deleteSkill(employeeId: string, officeScope: string | undefined, id: string) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.employeeSkill.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Skill not found', 404)
  await prisma.employeeSkill.delete({ where: { id } })
}

// ─── Certifications (Training) ───────────────────────────────────────────────

export async function listCertifications(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.certification.findMany({
    where: { employeeId },
    include: { document: { select: documentSelect } },
    orderBy: { issueDate: 'desc' },
  })
}

export async function createCertification(
  employeeId: string,
  officeScope: string | undefined,
  data: CreateCertificationInput,
  file: FileInput | undefined,
  uploadedById: string
) {
  await getEmployee(employeeId, officeScope)

  let documentId: string | undefined
  if (file) {
    const doc = await uploadDocument({
      employeeId,
      type: DocumentType.CERTIFICATE,
      name: file.originalName,
      buffer: file.buffer,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById,
    })
    documentId = doc.id
  }

  return prisma.certification.create({
    data: {
      employeeId,
      name: data.name,
      issuingOrganization: data.issuingOrganization,
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      credentialId: data.credentialId,
      credentialUrl: data.credentialUrl,
      documentId,
    },
    include: { document: { select: documentSelect } },
  })
}

export async function updateCertification(
  employeeId: string,
  officeScope: string | undefined,
  id: string,
  data: UpdateCertificationInput,
  file: FileInput | undefined,
  uploadedById: string
) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.certification.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Certification not found', 404)

  let documentId = existing.documentId
  if (file) {
    const doc = await uploadDocument({
      employeeId,
      type: DocumentType.CERTIFICATE,
      name: file.originalName,
      buffer: file.buffer,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById,
    })
    if (existing.documentId) await deactivateDocument(existing.documentId)
    documentId = doc.id
  }

  return prisma.certification.update({
    where: { id },
    data: {
      ...data,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      documentId,
    },
    include: { document: { select: documentSelect } },
  })
}

export async function deleteCertification(employeeId: string, officeScope: string | undefined, id: string) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.certification.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Certification not found', 404)
  if (existing.documentId) await deactivateDocument(existing.documentId)
  await prisma.certification.delete({ where: { id } })
}

// ─── Identification ───────────────────────────────────────────────────────────

export async function listIdentifications(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.identification.findMany({
    where: { employeeId },
    include: { document: { select: documentSelect } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createIdentification(
  employeeId: string,
  officeScope: string | undefined,
  data: CreateIdentificationInput,
  file: FileInput | undefined,
  uploadedById: string
) {
  await getEmployee(employeeId, officeScope)

  let documentId: string | undefined
  if (file) {
    const doc = await uploadDocument({
      employeeId,
      type: DocumentType.ID_PROOF,
      name: file.originalName,
      buffer: file.buffer,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById,
    })
    documentId = doc.id
  }

  return prisma.identification.create({
    data: {
      employeeId,
      type: data.type,
      documentNumber: data.documentNumber,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      documentId,
    },
    include: { document: { select: documentSelect } },
  })
}

export async function updateIdentification(
  employeeId: string,
  officeScope: string | undefined,
  id: string,
  data: UpdateIdentificationInput,
  file: FileInput | undefined,
  uploadedById: string
) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.identification.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Identification record not found', 404)

  let documentId = existing.documentId
  if (file) {
    const doc = await uploadDocument({
      employeeId,
      type: DocumentType.ID_PROOF,
      name: file.originalName,
      buffer: file.buffer,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById,
    })
    if (existing.documentId) await deactivateDocument(existing.documentId)
    documentId = doc.id
  }

  return prisma.identification.update({
    where: { id },
    data: {
      ...data,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      documentId,
    },
    include: { document: { select: documentSelect } },
  })
}

export async function deleteIdentification(employeeId: string, officeScope: string | undefined, id: string) {
  await getEmployee(employeeId, officeScope)
  const existing = await prisma.identification.findUnique({ where: { id } })
  if (!existing || existing.employeeId !== employeeId) throw new EmployeeError('Identification record not found', 404)
  if (existing.documentId) await deactivateDocument(existing.documentId)
  await prisma.identification.delete({ where: { id } })
}
