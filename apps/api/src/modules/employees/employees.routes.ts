import { Router, type Router as RouterType } from 'express'
import * as controller from './employees.controller'
import * as profileController from './profile.controller'
import * as avatarController from './avatar.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole, selfOrRole } from '../../middleware/rbac.middleware'
import { officeScope } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { UserRole } from '@hr-system/types'
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeRoleSchema,
  bankInfoSchema,
  listEmployeesQuerySchema,
  listDirectoryQuerySchema,
} from './employees.schemas'
import {
  createWorkExperienceSchema,
  updateWorkExperienceSchema,
  createEducationSchema,
  updateEducationSchema,
  createSkillSchema,
  updateSkillSchema,
  createCertificationSchema,
  updateCertificationSchema,
  createIdentificationSchema,
  updateIdentificationSchema,
} from './profile.schemas'

const router: RouterType = Router()

router.use(authenticate, officeScope)

const HR = requireRole(UserRole.HR_MANAGER) // HR_MANAGER and above
const MANAGER = requireRole(UserRole.DEPT_MANAGER) // managers and above
const SELF_OR_HR = selfOrRole('id', UserRole.HR_MANAGER) // self, or HR_MANAGER and above
const SELF_OR_MANAGER = selfOrRole('id', UserRole.DEPT_MANAGER) // self, or managers and above — for reads

// Directory is readable by everyone
router.get('/directory', validate(listDirectoryQuerySchema, 'query'), controller.directory)

// Listing / reading
router.get('/', MANAGER, validate(listEmployeesQuerySchema, 'query'), controller.list)
router.get('/:id', SELF_OR_MANAGER, controller.getById)
router.get('/:id/org-chart', controller.orgChart)

// Mutations (HR+, or self restricted to personal fields — see controller.update)
router.post('/', HR, validate(createEmployeeSchema), controller.create)
router.patch('/:id', SELF_OR_HR, validate(updateEmployeeSchema), controller.update)
router.patch('/:id/role', requireRole(UserRole.SUPER_ADMIN), validate(updateEmployeeRoleSchema), controller.updateRole)
router.delete('/:id', HR, controller.remove)

// Password reset (HR+ only) — generates a link for HR to relay manually, no email channel
router.post('/:id/reset-password', HR, controller.generatePasswordReset)

// Bank info (HR+ only — sensitive)
router.get('/:id/bank-info', HR, controller.getBankInfo)
router.put('/:id/bank-info', HR, validate(bankInfoSchema), controller.putBankInfo)

// Avatar (self, or HR+)
router.post('/:id/avatar', SELF_OR_HR, avatarController.upload.single('avatar'), avatarController.uploadAvatar)

// Work experience
router.get('/:id/work-experience', SELF_OR_MANAGER, profileController.listWorkExperience)
router.post(
  '/:id/work-experience',
  SELF_OR_HR,
  validate(createWorkExperienceSchema),
  profileController.createWorkExperience
)
router.patch(
  '/:id/work-experience/:weId',
  SELF_OR_HR,
  validate(updateWorkExperienceSchema),
  profileController.updateWorkExperience
)
router.delete('/:id/work-experience/:weId', SELF_OR_HR, profileController.deleteWorkExperience)

// Education
router.get('/:id/education', SELF_OR_MANAGER, profileController.listEducation)
router.post('/:id/education', SELF_OR_HR, validate(createEducationSchema), profileController.createEducation)
router.patch('/:id/education/:eduId', SELF_OR_HR, validate(updateEducationSchema), profileController.updateEducation)
router.delete('/:id/education/:eduId', SELF_OR_HR, profileController.deleteEducation)

// Skills
router.get('/:id/skills', SELF_OR_MANAGER, profileController.listSkills)
router.post('/:id/skills', SELF_OR_HR, validate(createSkillSchema), profileController.createSkill)
router.patch('/:id/skills/:skillId', SELF_OR_HR, validate(updateSkillSchema), profileController.updateSkill)
router.delete('/:id/skills/:skillId', SELF_OR_HR, profileController.deleteSkill)

// Certifications (Training) — multipart, file optional
router.get('/:id/certifications', SELF_OR_MANAGER, profileController.listCertifications)
router.post(
  '/:id/certifications',
  SELF_OR_HR,
  profileController.upload.single('file'),
  validate(createCertificationSchema),
  profileController.createCertification
)
router.patch(
  '/:id/certifications/:certId',
  SELF_OR_HR,
  profileController.upload.single('file'),
  validate(updateCertificationSchema),
  profileController.updateCertification
)
router.delete('/:id/certifications/:certId', SELF_OR_HR, profileController.deleteCertification)

// Identification — multipart, file optional
router.get('/:id/identifications', SELF_OR_MANAGER, profileController.listIdentifications)
router.post(
  '/:id/identifications',
  SELF_OR_HR,
  profileController.upload.single('file'),
  validate(createIdentificationSchema),
  profileController.createIdentification
)
router.patch(
  '/:id/identifications/:idId',
  SELF_OR_HR,
  profileController.upload.single('file'),
  validate(updateIdentificationSchema),
  profileController.updateIdentification
)
router.delete('/:id/identifications/:idId', SELF_OR_HR, profileController.deleteIdentification)

export { router as employeesRouter }
