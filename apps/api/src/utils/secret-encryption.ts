import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { env } from '../config/env'

// AES-256-GCM at-rest encryption for short secrets (currently: TOTP seeds).
// The configured key can be any sufficiently long string — hashed down to a
// fixed 32-byte key, the same "any long secret works" ergonomics already used
// for JWT_SECRET/JWT_REFRESH_SECRET — rather than requiring the env var itself
// to be exactly 32 raw bytes.
const KEY = createHash('sha256').update(env.TOTP_ENCRYPTION_KEY).digest()

const IV_LENGTH = 12 // standard AES-GCM nonce size

// Encrypted payloads are always exactly "<hex>:<hex>:<hex>" — a legitimate
// base32 TOTP secret never contains ':', so this detection can't false-positive.
// Lets already-enrolled users (whose secret predates this encryption-at-rest
// change) keep working without a separate migration script — callers can check
// this and fall back to treating the stored value as plaintext.
const ENCRYPTED_FORMAT = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i

export function isEncryptedSecret(payload: string): boolean {
  return ENCRYPTED_FORMAT.test(payload)
}

/** Encrypts a secret for storage at rest. Format: "<iv>:<authTag>:<ciphertext>", all hex. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Decrypts a secret written by encryptSecret. Throws if the payload is malformed or has been tampered with. */
export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':')
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted secret')
  }
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}
