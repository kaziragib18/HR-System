import { describe, it, expect } from 'vitest'
import { matchesFileSignature } from './upload'

describe('matchesFileSignature', () => {
  it('accepts a real PNG signature', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
    expect(matchesFileSignature('image/png', buf)).toBe(true)
  })

  it('accepts a real JPEG signature', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
    expect(matchesFileSignature('image/jpeg', buf)).toBe(true)
  })

  it('accepts a real WEBP signature (RIFF....WEBP)', () => {
    const buf = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])
    expect(matchesFileSignature('image/webp', buf)).toBe(true)
  })

  it('accepts a real PDF signature', () => {
    const buf = Buffer.from('%PDF-1.4 rest of file')
    expect(matchesFileSignature('application/pdf', buf)).toBe(true)
  })

  it('rejects a file whose declared mimetype does not match its real bytes', () => {
    // Someone declares Content-Type: image/png but the bytes are plain text.
    const buf = Buffer.from('just some plain text, not a real png')
    expect(matchesFileSignature('image/png', buf)).toBe(false)
  })

  it('rejects a mimetype outside the known allowlist', () => {
    expect(matchesFileSignature('application/x-msdownload', Buffer.from('MZ'))).toBe(false)
  })

  it('rejects a too-short buffer', () => {
    expect(matchesFileSignature('image/png', Buffer.from([0x89, 0x50]))).toBe(false)
  })
})
