'use client'

import { useState } from 'react'
import { Avatar, Spinner } from '@/components/ui/primitives'
import { Camera } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useUploadAvatar } from '@/lib/api/hooks/useEmployeeProfile'

export function AvatarUploader({
  employeeId,
  firstName,
  lastName,
  avatarUrl,
  canEdit,
  size = 64,
}: {
  employeeId: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  canEdit: boolean
  size?: number
}) {
  const { user, updateUser } = useAuthStore()
  const upload = useUploadAvatar(employeeId)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPreview(URL.createObjectURL(file))
    try {
      const result = await upload.mutateAsync(file)
      if (user?.employeeId === employeeId) updateUser({ avatarUrl: result.avatarUrl })
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed')
      setPreview(null)
    }
  }

  const displayUrl = preview ?? avatarUrl

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Avatar firstName={firstName} lastName={lastName} url={displayUrl} size={size} />
      {upload.isPending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
          <Spinner />
        </div>
      )}
      {canEdit && !upload.isPending && (
        <label
          className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          title="Change photo"
        >
          <Camera className="h-3 w-3" />
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleChange} />
        </label>
      )}
      {error && (
        <p className="absolute left-1/2 top-full mt-1 w-40 -translate-x-1/2 text-center text-[10px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
