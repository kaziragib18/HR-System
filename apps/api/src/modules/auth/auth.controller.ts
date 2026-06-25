import type { Request, Response } from 'express'
import * as authService from './auth.service'
import { AuthError, REFRESH_TOKEN_TTL_MS } from './auth.service'
import { verifyTempToken } from '../../utils/jwt'
import { sendSuccess, sendError } from '../../utils/response'
import { env } from '../../config/env'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type {
  LoginInput,
  TwoFactorVerifyInput,
  TwoFactorEnableInput,
  ChangePasswordInput,
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

function getDeviceInfo(req: Request): string {
  return req.headers['user-agent']?.slice(0, 255) ?? 'Unknown'
}

function handleError(res: Response, err: unknown) {
  if (err instanceof AuthError) {
    sendError(res, err.message, err.status)
    return
  }
  throw err
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
    sendSuccess(res, result)
  } catch (err) {
    handleError(res, err)
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken
    if (token) await authService.logout(token)
    clearRefreshCookie(res)
    sendSuccess(res, { message: 'Logged out' })
  } catch (err) {
    handleError(res, err)
  }
}

export async function logoutAll(req: Request, res: Response) {
  try {
    await authService.logoutAll((req as AuthRequest).user.sub)
    clearRefreshCookie(res)
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

export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput
    await authService.changePassword(
      (req as AuthRequest).user.sub,
      currentPassword,
      newPassword
    )
    clearRefreshCookie(res)
    sendSuccess(res, { message: 'Password changed. Please log in again.' })
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
