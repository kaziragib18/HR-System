import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret, isEncryptedSecret } from './secret-encryption'

describe('secret-encryption', () => {
  it('round-trips a secret through encrypt/decrypt', () => {
    const secret = 'JBSWY3DPEHPK3PXP' // example base32 TOTP secret
    const encrypted = encryptSecret(secret)
    expect(decryptSecret(encrypted)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV), but both decrypt correctly', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const a = encryptSecret(secret)
    const b = encryptSecret(secret)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(secret)
    expect(decryptSecret(b)).toBe(secret)
  })

  it('identifies its own output as encrypted', () => {
    expect(isEncryptedSecret(encryptSecret('JBSWY3DPEHPK3PXP'))).toBe(true)
  })

  it('does not mistake a legacy plaintext base32 secret for an encrypted one', () => {
    // speakeasy base32 secrets are uppercase A-Z2-7 — never contain ':', so this
    // can never collide with the "iv:tag:ciphertext" encrypted format.
    expect(isEncryptedSecret('JBSWY3DPEHPK3PXP')).toBe(false)
  })

  it('throws on a tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP')
    const [iv, tag, data] = encrypted.split(':')
    const tampered = `${iv}:${tag}:${data.slice(0, -2)}00`
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('throws on a malformed payload', () => {
    expect(() => decryptSecret('not-a-valid-payload')).toThrow('Malformed encrypted secret')
  })
})
