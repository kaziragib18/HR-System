import { Router, type Router as RouterType } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { requireCsrfToken } from '../../middleware/csrf.middleware'
import {
  loginSchema,
  twoFactorVerifySchema,
  twoFactorEnableSchema,
  changePasswordSchema,
  resetPasswordSchema,
  updateThemeSchema,
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

// /2fa/verify used to share the plain IP-keyed authLimiter above, which has
// two problems for a 6-digit-code brute-force target specifically: (1) two
// different users completing 2FA from behind the same IP (e.g. an office
// NAT) share one budget, so one can exhaust it for the other; (2) it gives no
// actual per-account lockout — an attacker who rotates source IPs gets a
// fresh budget against the SAME pending login each time. Keying by the
// tempToken itself (not combined with IP) fixes both: it's unique per pending
// login, so it can't be shared across users, and rotating IPs doesn't reset
// it since the token — not the IP — is the bucket.
const twoFactorVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
  keyGenerator: (req) => {
    const tempToken = (req.body as { tempToken?: string } | undefined)?.tempToken
    return tempToken ? `2fa:${tempToken}` : (req.ip ?? 'unknown')
  },
})

// /refresh had no dedicated limit at all beyond the global 200/15min — cheap
// to add since a legitimate browser only calls it once per access-token
// lifetime (15min) per tab via the silent-refresh queue, so this ceiling is
// far above normal use but still bounds outright hammering of the endpoint.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
})

// Public
router.post('/login', authLimiter, validate(loginSchema), controller.login)
router.post(
  '/2fa/verify',
  twoFactorVerifyLimiter,
  validate(twoFactorVerifySchema),
  controller.verifyTwoFactor
)
router.post('/refresh', refreshLimiter, requireCsrfToken, controller.refresh)
router.post('/logout', requireCsrfToken, controller.logout)
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
router.patch('/theme', authenticate, validate(updateThemeSchema), controller.updateTheme)

export { router as authRouter }
