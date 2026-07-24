import { describe, it, expect } from 'vitest'
import { changePasswordSchema, resetPasswordSchema } from './auth.schemas'

// Regression guard: the API must reject a weak password even if a client
// bypasses the frontend's own PASSWORD_REQUIREMENTS checklist and posts
// directly — see settings/security/page.tsx for the mirrored client-side list.
describe('password complexity — server-side enforcement', () => {
  const cases: { label: string; password: string; valid: boolean }[] = [
    { label: 'too short', password: 'Aa1!aaa', valid: false },
    { label: 'no uppercase', password: 'aaaaaaa1!', valid: false },
    { label: 'no lowercase', password: 'AAAAAAA1!', valid: false },
    { label: 'no number', password: 'Aaaaaaaa!', valid: false },
    { label: 'no symbol', password: 'Aaaaaaa1', valid: false },
    { label: 'meets every rule', password: 'Aaaaaaa1!', valid: true },
  ]

  for (const c of cases) {
    it(`changePasswordSchema: ${c.label}`, () => {
      const result = changePasswordSchema.safeParse({ currentPassword: 'whatever', newPassword: c.password })
      expect(result.success).toBe(c.valid)
    })

    it(`resetPasswordSchema: ${c.label}`, () => {
      const result = resetPasswordSchema.safeParse({ token: 'whatever', newPassword: c.password })
      expect(result.success).toBe(c.valid)
    })
  }
})
