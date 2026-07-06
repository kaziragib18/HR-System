import { Router, type Router as RouterType } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import {
  loginSchema,
  twoFactorVerifySchema,
  twoFactorEnableSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from './auth.schemas'

const router: RouterType = Router()

// Stricter rate limit on auth endpoints to slow brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
})

// Public
router.post('/login', authLimiter, validate(loginSchema), controller.login)
router.post(
  '/2fa/verify',
  authLimiter,
  validate(twoFactorVerifySchema),
  controller.verifyTwoFactor
)
router.post('/refresh', controller.refresh)
router.post('/logout', controller.logout)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword)

// Authenticated
router.get('/me', authenticate, controller.me)
router.post('/logout-all', authenticate, controller.logoutAll)
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword
)
router.post('/2fa/setup', authenticate, controller.setupTwoFactor)
router.post(
  '/2fa/enable',
  authenticate,
  validate(twoFactorEnableSchema),
  controller.enableTwoFactor
)
router.post('/2fa/disable', authenticate, controller.disableTwoFactor)
router.get('/sessions', authenticate, controller.listSessions)
router.delete('/sessions/:id', authenticate, controller.revokeSession)

export { router as authRouter }
