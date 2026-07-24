import { randomBytes } from 'crypto'
import { prisma } from '../../config/prisma'
import { comparePassword, hashPassword, compareAgainstDummyHash } from '../../utils/hash'
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
import { encryptSecret, decryptSecret, isEncryptedSecret } from '../../utils/secret-encryption'
import { env } from '../../config/env'
import type { AuthUser, SessionInfo, Theme } from '@hr-system/types'
import { UserRole, THEME_VALUES } from '@hr-system/types'

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

// Verifies a TOTP code against a stored secret that may still be legacy
// plaintext (pre-dating encryption-at-rest) — and transparently migrates it to
// an encrypted value on the first successful verify, with no separate
// migration script needed.
async function verifyAndMigrateTwoFactorSecret(
  userId: string,
  storedSecret: string,
  code: string
): Promise<boolean> {
  const wasEncrypted = isEncryptedSecret(storedSecret)
  const plaintext = wasEncrypted ? decryptSecret(storedSecret) : storedSecret
  const valid = verifyTwoFactorToken(plaintext, code)
  if (valid && !wasEncrypted) {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encryptSecret(plaintext) } })
  }
  return valid
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
    officeWorkStartTime: user.employee.office.workStartTime,
    officeWorkEndTime: user.employee.office.workEndTime,
    firstName: user.employee.firstName,
    lastName: user.employee.lastName,
    avatarUrl: user.employee.avatarUrl,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    departmentId: user.employee.departmentId,
    departmentName: user.employee.department?.name ?? null,
    theme: (THEME_VALUES as readonly string[]).includes(user.theme) ? (user.theme as Theme) : 'light',
  }
}

async function createSession(userId: string, deviceInfo?: string, ipAddress?: string) {
  // refreshToken is unique and embeds the session's own id, so it can't be
  // known before the row exists — create with a placeholder, then fill in
  // the real token. Both wrapped in one transaction: if anything between the
  // two statements fails (a crash, a dropped DB connection — this pooler has
  // hiccupped more than once), Postgres rolls the whole thing back instead of
  // leaving a stale row behind. That stale-placeholder scenario is exactly
  // what broke login for everyone previously — a fixed literal ('pending')
  // left over from an interrupted attempt collided with the unique
  // constraint on every subsequent login. The random suffix is defense in
  // depth on top of the transaction, not a substitute for it.
  return prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        refreshToken: `pending-${randomBytes(16).toString('hex')}`,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    })
    const refreshToken = signRefreshToken(userId, session.id)
    await tx.session.update({
      where: { id: session.id },
      data: { refreshToken },
    })
    return refreshToken
  })
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
    // Still perform a (dummy) bcrypt compare so this path takes roughly the
    // same time as a real user's wrong-password path below — otherwise the
    // response-time difference lets an attacker enumerate valid emails.
    await compareAgainstDummyHash(password)
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

  if (!(await verifyAndMigrateTwoFactorSecret(user.id, user.twoFactorSecret, code))) {
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

export async function refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new AuthError('Invalid refresh token')
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  })
  if (!session || !session.isValid) {
    throw new AuthError('Session expired')
  }

  if (session.refreshToken !== refreshToken) {
    // Doesn't match the session's current token. If it matches the token we
    // rotated *away from* last time, this is a replay of an already-used
    // refresh token — most likely leaked/stolen — so kill the whole session
    // rather than just rejecting this one request, forcing a real re-login.
    if (session.previousRefreshToken && session.previousRefreshToken === refreshToken) {
      await prisma.session.update({ where: { id: session.id }, data: { isValid: false } })
    }
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

  // Rotate on every use: the presented token becomes the new "previous"
  // (kept only to detect a replay, see above) and a fresh token takes its
  // place — a stolen refresh token is only ever usable for one rotation
  // before either party's next use invalidates the other's copy.
  const newRefreshToken = signRefreshToken(user.id, session.id)
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshToken,
      previousRefreshToken: session.refreshToken,
      lastUsedAt: new Date(),
    },
  })

  return { accessToken: signAccessToken(toAuthUser(user)), refreshToken: newRefreshToken }
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

export async function updateTheme(userId: string, theme: Theme): Promise<{ theme: Theme }> {
  await prisma.user.update({ where: { id: userId }, data: { theme } })
  return { theme }
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
  // Store the secret encrypted at rest but keep 2FA disabled until verified —
  // the plaintext is only ever returned to the caller for the QR code/manual
  // entry, never persisted unencrypted.
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptSecret(base32) },
  })
  const qrCode = await generateQRCode(otpauthUrl)
  return { secret: base32, qrCode }
}

export async function enableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.twoFactorSecret) {
    throw new AuthError('Run 2FA setup first', 400)
  }
  if (!(await verifyAndMigrateTwoFactorSecret(user.id, user.twoFactorSecret, code))) {
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
