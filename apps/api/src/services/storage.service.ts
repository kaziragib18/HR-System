import { supabase } from '../config/supabase'

export const BUCKETS = {
  AVATARS: 'avatars',
  DOCUMENTS: 'documents',
  PAYSLIPS: 'payslips',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

/**
 * Generates a signed URL the client uses to upload a file directly to Supabase
 * Storage (no streaming through the API).
 */
export async function createSignedUploadUrl(bucket: BucketName, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error) throw new Error(`Failed to create upload URL: ${error.message}`)
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/** Signed URL to read a private file (valid for `expiresIn` seconds). */
export async function createSignedReadUrl(
  bucket: BucketName,
  path: string,
  expiresIn = 3600
) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw new Error(`Failed to create read URL: ${error.message}`)
  return data.signedUrl
}

/** Public URL for buckets configured as public (e.g. avatars). */
export function getPublicUrl(bucket: BucketName, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(`Failed to delete file: ${error.message}`)
}
