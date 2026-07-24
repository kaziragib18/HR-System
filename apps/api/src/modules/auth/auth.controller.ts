import { randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import * as authService from './auth.service'
import { AuthError, REFRESH_TOKEN_TTL_MS } from './auth.service'
import { verifyTempToken } from '../../utils/jwt'
import { sendSuccess, sendError, sendUnexpectedError } from '../../utils/response'
import { env } from '../../config/env'
import { CSRF_COOKIE } from '../../middleware/csrf.middleware'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type {
  LoginInput,
  TwoFactorVerifyInput,
  TwoFactorEnableInput,
  ChangePasswordInput,
  ResetPasswordInput,
  UpdateThemeInput,
} from './auth.schemas'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/' })
}

// Companion cookie for requireCsrfToken (csrf.middleware.ts) — deliberately
// NOT httpOnly, since the frontend must be able to read it and echo it back
// as a header; that's the whole double-submit mechanism. Same lifetime/flags
// as the refresh cookie otherwise, so it never outlives (or expires before)
// the session it's protecting.
function setCsrfCookie(res: Response, token: string) {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  })
}

function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE, { path: '/' })
}

function getDeviceInfo(req: Request): string {
  return req.headers['user-agent']?.slice(0, 255) ?? 'Unknown'
}

function handleError(res: Response, err: unknown) {
  if (err instanceof AuthError) {
    sendError(res, err.message, err.status)
    return
  }
  sendUnexpectedError(res, err)
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as LoginInput
    const result = await authService.login(
      email,
      password,
      getDeviceInfo(req),
      req.ip
    )

    if (result.requiresTwoFactor) {
      sendSuccess(res, { requiresTwoFactor: true, tempToken: result.tempToken })
      return
    }

    setRefreshCookie(res, result.refreshToken!)
    setCsrfCookie(res, randomBytes(24).toString('hex'))
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      requiresTwoFactor: false,
    })
  } catch (err) {
    handleError(res, err)
  }
}

export async function verifyTwoFactor(req: Request, res: Response) {
  try {
    const { tempToken, code } = req.body as TwoFactorVerifyInput
    let userId: string
    try {
      userId = verifyTempToken(tempToken).sub
    } catch {
      sendError(res, 'Two-factor session expired. Please log in again.', 401)
      return
    }

    const result = await authService.completeTwoFactorLogin(
      userId,
      code,
      getDeviceInfo(req),
      req.ip
    )
    setRefreshCookie(res, result.refreshToken!)
    setCsrfCookie(res, randomBytes(24).toString('hex'))
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      requiresTwoFactor: false,
    })
  } catch (err) {
    handleError(res, err)
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken
    if (!token) {
      sendError(res, 'No refresh token', 401)
      return
    }
    const result = await authService.refresh(token)
    setRefreshCookie(res, result.refreshToken)
    // Mints a CSRF cookie for any session that predates this protection
    // (see csrf.middleware.ts) — no-op in practice for sessions that already
    // have one, since we just re-set the same value.
    setCsrfCookie(res, req.cookies?.[CSRF_COOKIE] ?? randomBytes(24).toString('hex'))
    sendSuccess(res, { accessToken: result.accessToken })
  } catch (err) {
    handleError(res, err)
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken
    if (token) await authService.logout(token)
    clearRefreshCookie(res)
    clearCsrfCookie(res)
    sendSuccess(res, { message: 'Logged out' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function logoutAll(req: Request, res: Response) {
  try {
    await authService.logoutAll((req as AuthRequest).user.sub)
    clearRefreshCookie(res)
    clearCsrfCookie(res)
    sendSuccess(res, { message: 'Logged out of all devices' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function me(req: Request, res: Response) {
  try {
    const user = await authService.getMe((req as AuthRequest).user.sub)
    sendSuccess(res, user)
  } catch (err) {
    handleError(res, err)
  }
}

export async function updateTheme(req: Request, res: Response) {
  try {
    const { theme } = req.body as UpdateThemeInput
    const result = await authService.updateTheme((req as AuthRequest).user.sub, theme)
    sendSuccess(res, result)
  } catch (err) {
    handleError(res, err)
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput
    await authService.changePassword(
      (req as AuthRequest).user.sub,
      currentPassword,
      newPassword
    )
    clearRefreshCookie(res)
    clearCsrfCookie(res)
    sendSuccess(res, { message: 'Password changed. Please log in again.' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body as ResetPasswordInput
    await authService.resetPassword(token, newPassword)
    sendSuccess(res, { message: 'Password reset. Please log in with your new password.' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function setupTwoFactor(req: Request, res: Response) {
  try {
    const result = await authService.setupTwoFactor((req as AuthRequest).user.sub)
    sendSuccess(res, result)
  } catch (err) {
    handleError(res, err)
  }
}

export async function enableTwoFactor(req: Request, res: Response) {
  try {
    const { code } = req.body as TwoFactorEnableInput
    await authService.enableTwoFactor((req as AuthRequest).user.sub, code)
    sendSuccess(res, { message: 'Two-factor authentication enabled' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function disableTwoFactor(req: Request, res: Response) {
  try {
    await authService.disableTwoFactor((req as AuthRequest).user.sub)
    sendSuccess(res, { message: 'Two-factor authentication disabled' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function listSessions(req: Request, res: Response) {
  try {
    const sessions = await authService.listSessions(
      (req as AuthRequest).user.sub,
      req.cookies?.refreshToken
    )
    sendSuccess(res, sessions)
  } catch (err) {
    handleError(res, err)
  }
}

export async function revokeSession(req: Request, res: Response) {
  try {
    await authService.revokeSession((req as AuthRequest).user.sub, req.params.id)
    sendSuccess(res, { message: 'Session revoked' })
  } catch (err) {
    handleError(res, err)
  }
}
