const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const IMAGE_AND_PDF_TYPES = [...IMAGE_TYPES, 'application/pdf']

export function isAllowedImageOrPdf(mimetype: string): boolean {
  return IMAGE_AND_PDF_TYPES.includes(mimetype)
}

export function isAllowedImage(mimetype: string): boolean {
  return IMAGE_TYPES.includes(mimetype)
}

export const ALLOWED_UPLOAD_MESSAGE = 'Only PDF and image files are allowed'
export const ALLOWED_IMAGE_MESSAGE = 'Only image files are allowed'

/**
 * Strips a client-supplied filename down to safe characters before it's used
 * to build a storage key — an unsanitized `originalname` (attacker-controlled)
 * spliced directly into a path could otherwise carry characters like `/` into
 * the object key. Every upload site should sanitize through this rather than
 * re-implementing the same regex inline.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function hasBytesAt(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false
  return signature.every((byte, i) => buffer[offset + i] === byte)
}

// Only the small, closed set of types this app ever accepts — each has a
// short, stable magic-byte signature, so this doesn't need a dependency the
// way sniffing an open-ended set of file types would.
const FILE_SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  'image/png': (buf) => hasBytesAt(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (buf) => hasBytesAt(buf, [0xff, 0xd8, 0xff]),
  'image/jpg': (buf) => hasBytesAt(buf, [0xff, 0xd8, 0xff]),
  'image/webp': (buf) => hasBytesAt(buf, [0x52, 0x49, 0x46, 0x46]) && hasBytesAt(buf, [0x57, 0x45, 0x42, 0x50], 8),
  'application/pdf': (buf) => hasBytesAt(buf, [0x25, 0x50, 0x44, 0x46]),
}

/**
 * Verifies a file's actual bytes match its declared mimetype. multer/busboy
 * take `mimetype` verbatim from the client's multipart `Content-Type` part —
 * an attacker can declare any type regardless of the real file content, so
 * the mimetype allowlist alone (isAllowedImage/isAllowedImageOrPdf) isn't
 * sufficient on its own; pair it with this at every upload site.
 */
export function matchesFileSignature(mimetype: string, buffer: Buffer): boolean {
  const check = FILE_SIGNATURES[mimetype]
  return check ? check(buffer) : false
}
