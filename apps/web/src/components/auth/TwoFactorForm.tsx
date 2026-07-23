'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { useAuthStore } from '@/store/auth.store'
import type { LoginResponse } from '@hr-system/types'

export function TwoFactorForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const tempToken = searchParams.get('token') ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/auth/2fa/verify',
        { tempToken, code }
      )
      const { user, accessToken } = res.data.data
      setAuth(user, accessToken!)
      router.push('/')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Invalid code'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!tempToken) {
    return (
      <p className="text-sm text-destructive">
        Missing session. Please <a href="/login" className="underline">log in</a> again.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="code">
          Authentication code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="w-full rounded-md border bg-background px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <p className="text-xs text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  )
}
