import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression guard for the login timing side-channel fix: a nonexistent-user
// response must still perform a bcrypt-cost operation (the dummy compare),
// not short-circuit — otherwise "no such user" is measurably faster than
// "wrong password" and lets an attacker enumerate registered emails.
const hashMocks = vi.hoisted(() => ({
  comparePassword: vi.fn(async () => false),
  compareAgainstDummyHash: vi.fn(async () => undefined),
  hashPassword: vi.fn(async () => 'hashed'),
}))

vi.mock('../../utils/hash', () => hashMocks)

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async (args: { data: unknown }) => ({ id: 'u1', ...(args.data as object) })),
    },
  },
}))

import { login } from './auth.service'
import { prisma } from '../../config/prisma'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('login — timing side-channel', () => {
  it('performs a dummy bcrypt compare (not a short-circuit) when the user does not exist', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(login('nobody@test.com', 'whatever-password')).rejects.toThrow('Invalid email or password')

    expect(hashMocks.compareAgainstDummyHash).toHaveBeenCalledWith('whatever-password')
    expect(hashMocks.comparePassword).not.toHaveBeenCalled()
  })

  it('does not perform the dummy compare when the user does exist (real compare runs instead)', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1',
      isActive: true,
      lockedUntil: null,
      loginAttempts: 0,
      passwordHash: 'irrelevant',
      isTwoFactorEnabled: false,
      employee: { id: 'e1', officeId: 'o1', office: { code: 'BD' }, department: null },
    })
    hashMocks.comparePassword.mockResolvedValueOnce(false)

    await expect(login('real@test.com', 'wrong-password')).rejects.toThrow('Invalid email or password')

    expect(hashMocks.comparePassword).toHaveBeenCalledWith('wrong-password', 'irrelevant')
    expect(hashMocks.compareAgainstDummyHash).not.toHaveBeenCalled()
  })
})
