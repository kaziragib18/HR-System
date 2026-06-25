'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import {
  useChangePassword,
  useSetupTwoFactor,
  useEnableTwoFactor,
  useDisableTwoFactor,
} from '@/lib/api/hooks/useAuthActions'
import { ShieldCheck, ShieldOff } from 'lucide-react'

const field =
  'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type PwForm = z.infer<typeof pwSchema>

export default function SecuritySettingsPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <ChangePasswordCard />
      <TwoFactorCard />
    </div>
  )
}

function ChangePasswordCard() {
  const router = useRouter()
  const changePassword = useChangePassword()
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const onSubmit = async (values: PwForm) => {
    await changePassword.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
    setDone(true)
    // Password change invalidates sessions — send back to login shortly.
    setTimeout(() => router.replace('/login'), 1500)
  }

  return (
    <Card>
      <h2 className="text-sm font-medium">Change password</h2>
      {done ? (
        <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
          Password changed. Redirecting to login…
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Current password</label>
            <input type="password" className={field} {...register('currentPassword')} />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm">New password</label>
            <input type="password" className={field} {...register('newPassword')} />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm">Confirm new password</label>
            <input type="password" className={field} {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          {changePassword.isError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(changePassword.error as { response?: { data?: { error?: string } } })?.response?.data
                ?.error ?? 'Failed to change password'}
            </p>
          )}
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {changePassword.isPending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </Card>
  )
}

function TwoFactorCard() {
  const { user, updateUser } = useAuthStore()
  const setup = useSetupTwoFactor()
  const enable = useEnableTwoFactor()
  const disable = useDisableTwoFactor()
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enabled = user?.isTwoFactorEnabled

  const startSetup = async () => {
    setError(null)
    const res = await setup.mutateAsync()
    setQr(res.qrCode)
  }

  const confirmEnable = async () => {
    setError(null)
    try {
      await enable.mutateAsync(code)
      updateUser({ isTwoFactorEnabled: true })
      setQr(null)
      setCode('')
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Invalid code'
      )
    }
  }

  const turnOff = async () => {
    await disable.mutateAsync()
    updateUser({ isTwoFactorEnabled: false })
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h2 className="text-sm font-medium">Two-factor authentication</h2>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Enabled — required at every login.' : 'Add a TOTP authenticator app.'}
            </p>
          </div>
        </div>
        {enabled ? (
          <button
            onClick={turnOff}
            disabled={disable.isPending}
            className="rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Disable
          </button>
        ) : (
          !qr && (
            <button
              onClick={startSetup}
              disabled={setup.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {setup.isPending ? 'Loading…' : 'Set up'}
            </button>
          )
        )}
      </div>

      {qr && !enabled && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            1. Scan this QR code with Google Authenticator, Authy, or 1Password.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="2FA QR code" className="h-44 w-44 rounded-md border" />
          <p className="text-sm text-muted-foreground">2. Enter the 6-digit code to confirm.</p>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className={`${field} max-w-[140px] text-center tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              onClick={confirmEnable}
              disabled={code.length !== 6 || enable.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {enable.isPending ? 'Verifying…' : 'Enable'}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </Card>
  )
}
