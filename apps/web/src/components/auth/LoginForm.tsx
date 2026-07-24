'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { useAuthStore } from '@/store/auth.store'
import type { LoginResponse } from '@hr-system/types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

// Distinguishes "the server told us the credentials are wrong" from "we
// never got a real answer" — collapsing both into a fixed "Invalid email or
// password" (the previous behavior) is actively misleading when the real
// cause is the API being down, a network drop, or an unexpected 500: it
// tells the user to re-check a password that was never actually checked.
function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      // Server responded with an error status — trust its message if present.
      return err.response.data?.error ?? `Something went wrong (server responded ${err.response.status}).`
    }
    if (err.request) {
      // Request went out but no response ever came back — server down, CORS, timeout, etc.
      return 'Cannot reach the server right now. Please check your connection and try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/auth/login',
        data
      )
      const { user, accessToken, requiresTwoFactor, tempToken } = res.data.data

      if (requiresTwoFactor && tempToken) {
        router.push(`/2fa?token=${encodeURIComponent(tempToken)}`)
        return
      }

      setAuth(user, accessToken)
      const redirect = searchParams.get('redirect') ?? '/'
      router.push(redirect)
    } catch (err: unknown) {
      setError(loginErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-3 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-[#3C7A96]/50"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-10 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-[#3C7A96]/50"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3C7A96] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#346a84] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" /> Sign in
          </>
        )}
      </button>
    </form>
  )
}
