import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'
import type { AuthUser } from '@hr-system/types'

export interface AccessTokenPayload {
  sub: string       // userId
  employeeId: string
  email: string
  role: string
  officeId: string
  officeCode: string
}

export interface RefreshTokenPayload {
  sub: string       // userId
  sessionId: string
}

export interface TempTokenPayload {
  sub: string       // userId
  requiresTwoFactor: true
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      officeId: user.officeId,
      officeCode: user.officeCode,
    } satisfies AccessTokenPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  )
}

export function signRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { sub: userId, sessionId } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions
  )
}

export function signTempToken(userId: string): string {
  return jwt.sign(
    { sub: userId, requiresTwoFactor: true } satisfies TempTokenPayload,
    env.JWT_SECRET,
    { expiresIn: '5m' }
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
}

export function verifyTempToken(token: string): TempTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TempTokenPayload
}
