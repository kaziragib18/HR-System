const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const IMAGE_AND_PDF_TYPES = [...IMAGE_TYPES, 'application/pdf']

/** Mirrors the mimetype check in leave.controller.ts's uploadAttachment. */
export function isAllowedImageOrPdf(mimetype: string): boolean {
  return IMAGE_AND_PDF_TYPES.includes(mimetype)
}

export function isAllowedImage(mimetype: string): boolean {
  return IMAGE_TYPES.includes(mimetype)
}

export const ALLOWED_UPLOAD_MESSAGE = 'Only PDF and image files are allowed'
export const ALLOWED_IMAGE_MESSAGE = 'Only image files are allowed'
