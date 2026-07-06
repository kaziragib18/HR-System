import { randomBytes } from 'crypto'
import { prisma } from '../../config/prisma'
import { comparePassword, hashPassword } from '../../utils/hash'
import {
  signAccessToken,
  signRefreshToken,
  signTempToken,
  verifyRefreshToken,
} from '../../utils/jwt'
import {
  generateTwoFactorSecret,
  generateQRCode,
  verifyTwoFactorToken,
} from '../../services/twofa.service'
import { env } from '../../config/env'
import type { AuthUser, SessionInfo } from '@hr-system/types'
import { UserRole } from '@hr-system/types'

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401
  ) {
    super(message)
  }
}

type UserWithEmployee = NonNullable<Awaited<ReturnType<typeof findUserWithEmployee>>>

function findUserWithEmployee(where: { id: string } | { email: string }) {
  return prisma.user.findUnique({
    where: where as { id: string },
    include: {
      employee: {
        include: {
          office: true,
          department: { select: { name: true } },
        },
      },
    },
  })
}

function toAuthUser(user: UserWithEmployee): AuthUser {
  return {
    id: user.id,
    employeeId: user.employee.id,
    email: user.email,
    role: user.role as UserRole,
    officeId: user.employee.officeId,
    officeCode: user.employee.office.code,
    firstName: user.employee.firstName,
    lastName: user.employee.lastName,
    avatarUrl: user.employee.avatarUrl,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    departmentName: user.employee.department?.name ?? null,
  }
}

async function createSession(userId: string, deviceInfo?: string, ipAddress?: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      refreshToken: 'pending', // replaced below once we have the session id
      deviceInfo,
      ipAddress,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  })
  const refreshToken = signRefreshToken(userId, session.id)
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken },
  })
  return refreshToken
}

interface LoginResult {
  requiresTwoFactor: boolean
  tempToken?: string
  user?: AuthUser
  accessToken?: string
  refreshToken?: string
}

export async function login(
  email: string,
  password: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<LoginResult> {
  const user = await findUserWithEmployee({ email })
  if (!user || !user.isActive) {
    throw new AuthError('Invalid email or password')
  }

  // Account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError('Account locked. Try again later.', 423)
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    const attempts = user.loginAttempts + 1
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    })
    throw new AuthError('Invalid email or password')
  }

  // Reset attempts on successful password check
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  })

  // 2FA gate
  if (user.isTwoFactorEnabled) {
    return { requiresTwoFactor: true, tempToken: signTempToken(user.id) }
  }

  const refreshToken = await createSession(user.id, deviceInfo, ipAddress)
  return {
    requiresTwoFactor: false,
    user: toAuthUser(user),
    accessToken: signAccessToken(toAuthUser(user)),
    refreshToken,
  }
}

export async function completeTwoFactorLogin(
  userId: string,
  code: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<LoginResult> {
  const user = await findUserWithEmployee({ id: userId })
  if (!user || !user.isActive || !user.twoFactorSecret) {
    throw new AuthError('Invalid session')
  }

  if (!verifyTwoFactorToken(user.twoFactorSecret, code)) {
    throw new AuthError('Invalid authentication code')
  }

  const refreshToken = await createSession(user.id, deviceInfo, ipAddress)
  return {
    requiresTwoFactor: false,
    user: toAuthUser(user),
    accessToken: signAccessToken(toAuthUser(user)),
    refreshToken,
  }
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new AuthError('Invalid refresh token')
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  })
  if (!session || !session.isValid || session.refreshToken !== refreshToken) {
    throw new AuthError('Session expired')
  }
  if (session.expiresAt < new Date()) {
    await prisma.session.update({ where: { id: session.id }, data: { isValid: false } })
    throw new AuthError('Session expired')
  }

  const user = await findUserWithEmployee({ id: payload.sub })
  if (!user || !user.isActive) {
    throw new AuthError('User not found')
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return { accessToken: signAccessToken(toAuthUser(user)) }
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken)
    await prisma.session.updateMany({
      where: { id: payload.sessionId },
      data: { isValid: false },
    })
  } catch {
    // Token invalid/expired — nothing to revoke
  }
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, isValid: true },
    data: { isValid: false },
  })
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await findUserWithEmployee({ id: userId })
  if (!user) throw new AuthError('User not found', 404)
  return toAuthUser(user)
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError('User not found', 404)

  const valid = await comparePassword(currentPassword, user.passwordHash)
  if (!valid) throw new AuthError('Current password is incorrect', 400)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  })

  // Invalidate all other sessions after a password change
  await prisma.session.updateMany({
    where: { userId, isValid: true },
    data: { isValid: false },
  })
}

// ─── Password reset (HR-relay — no email channel exists in this codebase) ─────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Generates a reset token for HR to copy and relay to the employee. */
export async function requestPasswordReset(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError('User not found', 404)

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  await prisma.passwordReset.create({ data: { userId, token, expiresAt } })
  return { token, expiresAt }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const reset = await prisma.passwordReset.findUnique({ where: { token } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new AuthError('Invalid or expired reset link', 400)
  }

  await prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  })
  await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })

  // Invalidate all sessions — same precaution as a self-service password change.
  await prisma.session.updateMany({
    where: { userId: reset.userId, isValid: true },
    data: { isValid: false },
  })
}

// ─── Two-Factor setup ─────────────────────────────────────────────────────────

export async function setupTwoFactor(
  userId: string
): Promise<{ secret: string; qrCode: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError('User not found', 404)

  const { base32, otpauthUrl } = generateTwoFactorSecret(user.email)
  // Store secret but keep 2FA disabled until verified
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: base32 },
  })
  const qrCode = await generateQRCode(otpauthUrl)
  return { secret: base32, qrCode }
}

export async function enableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.twoFactorSecret) {
    throw new AuthError('Run 2FA setup first', 400)
  }
  if (!verifyTwoFactorToken(user.twoFactorSecret, code)) {
    throw new AuthError('Invalid authentication code', 400)
  }
  await prisma.user.update({
    where: { id: userId },
    data: { isTwoFactorEnabled: true },
  })
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isTwoFactorEnabled: false, twoFactorSecret: null },
  })
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function listSessions(
  userId: string,
  currentRefreshToken?: string
): Promise<SessionInfo[]> {
  const sessions = await prisma.session.findMany({
    where: { userId, isValid: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  return sessions.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    isCurrent: s.refreshToken === currentRefreshToken,
  }))
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { isValid: false },
  })
}

export { REFRESH_TOKEN_TTL_MS }
