'use client'

import { useState, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, Skeleton, SubmitOverlay } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import {
  useChangePassword,
  useSetupTwoFactor,
  useEnableTwoFactor,
  useDisableTwoFactor,
  useSessions,
  useRevokeSession,
  useRevokeSessions,
  type SessionInfo,
} from '@/lib/api/hooks/useAuthActions'
import { cn } from '@/lib/utils'
import {
  ShieldCheck, ShieldOff, Lock, Eye, EyeOff, Loader2, CheckCircle2, Circle,
  Copy, Check, Monitor, Smartphone, LogOut, AlertTriangle, MapPin,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const field =
  'w-full rounded-md border bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

// Single source of truth for the new-password policy — used both to render
// the live requirements checklist and (via `test`) to gate the submit button.
const PASSWORD_REQUIREMENTS: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'number', label: 'One number (0-9)', test: (pw) => /\d/.test(pw) },
  { key: 'symbol', label: 'One special character (!@#$…)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/\d/, 'Must include a number')
      .regex(/[^A-Za-z0-9]/, 'Must include a special character'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  })

type PwForm = z.infer<typeof pwSchema>

// ── Shared bits ───────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, iconCls, title, description }: {
  icon: LucideIcon; iconCls: string; title: string; description?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', iconCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

const PasswordInput = forwardRef<HTMLInputElement, {
  label: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ label, error, ...rest }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label className="text-sm">{label}</label>
      <div className="relative">
        <input ref={ref} type={show ? 'text' : 'password'} className={field} {...rest} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
})

function PasswordRequirements({ password, differsFromCurrent }: { password: string; differsFromCurrent: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {PASSWORD_REQUIREMENTS.map((r) => {
        const met = r.test(password)
        return (
          <div
            key={r.key}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {met ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
            {r.label}
          </div>
        )
      })}
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs transition-colors',
          differsFromCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {differsFromCurrent ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
        Different from current password
      </div>
    </div>
  )
}

// ── Change password ──────────────────────────────────────────────────────────

function ChangePasswordCard() {
  const router = useRouter()
  const changePassword = useChangePassword()
  const [done, setDone] = useState(false)
  const [newPwTouched, setNewPwTouched] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const newPassword = watch('newPassword') ?? ''
  const currentPassword = watch('currentPassword') ?? ''
  const differsFromCurrent = newPassword.length > 0 && newPassword !== currentPassword
  const requirementsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(newPassword)) && differsFromCurrent
  const showRequirements = newPwTouched || newPassword.length > 0
  const isPending = changePassword.isPending

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
    <Card className="relative">
      <SectionHeader
        icon={Lock}
        iconCls="bg-primary/10 text-primary"
        title="Change password"
        description="Use a strong, unique password you don't use elsewhere."
      />
      {done ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Password changed</p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
              <Loader2 className="h-3 w-3 animate-spin" /> Redirecting to login…
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <SubmitOverlay show={isPending} label="Updating password…" />
          <fieldset disabled={isPending} className="contents">
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
              <PasswordInput
                label="Current password"
                placeholder="Enter your current password"
                error={errors.currentPassword?.message}
                {...register('currentPassword')}
              />
              <div>
                <PasswordInput
                  label="New password"
                  placeholder="Enter a new password"
                  error={errors.newPassword?.message}
                  onFocus={() => setNewPwTouched(true)}
                  {...register('newPassword')}
                />
                {showRequirements && (
                  <PasswordRequirements password={newPassword} differsFromCurrent={differsFromCurrent} />
                )}
              </div>
              <PasswordInput
                label="Confirm new password"
                placeholder="Re-enter your new password"
                error={errors.confirm?.message}
                {...register('confirm')}
              />
              {changePassword.isError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {(changePassword.error as { response?: { data?: { error?: string } } })?.response?.data
                    ?.error ?? 'Failed to change password'}
                </p>
              )}
              <button
                type="submit"
                disabled={isPending || !requirementsMet}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isPending ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </fieldset>
        </div>
      )}
    </Card>
  )
}

// ── Two-factor authentication ────────────────────────────────────────────────

function DisableTwoFactorModal({ onClose, onConfirm, isPending }: {
  onClose: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={isPending} label="Disabling…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">Disable two-factor authentication?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account will only be protected by your password. You can set it back up any time.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={isPending} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TwoFactorCard() {
  const { user, updateUser } = useAuthStore()
  const setup = useSetupTwoFactor()
  const enable = useEnableTwoFactor()
  const disable = useDisableTwoFactor()
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const enabled = user?.isTwoFactorEnabled

  const startSetup = async () => {
    setError(null)
    const res = await setup.mutateAsync()
    setQr(res.qrCode)
    setSecret(res.secret)
  }

  const confirmEnable = async () => {
    setError(null)
    try {
      await enable.mutateAsync(code)
      updateUser({ isTwoFactorEnabled: true })
      setQr(null)
      setSecret(null)
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
    setConfirmDisable(false)
  }

  function copySecret() {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="relative">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          icon={enabled ? ShieldCheck : ShieldOff}
          iconCls={enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}
          title="Two-factor authentication"
          description={enabled ? 'Enabled — required at every login.' : 'Add a TOTP authenticator app for extra protection.'}
        />
        {enabled ? (
          <button
            onClick={() => setConfirmDisable(true)}
            className="shrink-0 rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Disable
          </button>
        ) : (
          !qr && (
            <button
              onClick={startSetup}
              disabled={setup.isPending}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {setup.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {setup.isPending ? 'Loading…' : 'Set up'}
            </button>
          )
        )}
      </div>

      {qr && !enabled && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="2FA QR code" className="h-40 w-40 shrink-0 rounded-lg border p-1" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium">1. Scan this QR code</p>
                <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or 1Password.</p>
              </div>
              {secret && (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Can&apos;t scan? Enter this code manually:</p>
                  <div className="mt-1 flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed tracking-wider">{secret}</code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">2. Enter the 6-digit code to confirm</p>
                <div className="mt-1.5 flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full max-w-[140px] rounded-md border bg-background px-3 py-2 text-center text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-ring"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    onClick={confirmEnable}
                    disabled={code.length !== 6 || enable.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {enable.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {enable.isPending ? 'Verifying…' : 'Enable'}
                  </button>
                </div>
                {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDisable && (
        <DisableTwoFactorModal onClose={() => setConfirmDisable(false)} onConfirm={turnOff} isPending={disable.isPending} />
      )}
    </Card>
  )
}

// ── Active sessions ──────────────────────────────────────────────────────────

/** Lightweight User-Agent parse — good enough for a friendly device label, no dependency needed. */
function parseDevice(ua: string | null): { label: string; icon: LucideIcon } {
  if (!ua) return { label: 'Unknown device', icon: Monitor }
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  let os = 'Unknown OS'
  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS'
  else if (/Linux/i.test(ua)) os = 'Linux'
  let browser = 'Unknown browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  return { label: `${browser} on ${os}`, icon: isMobile ? Smartphone : Monitor }
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RevokeModal({ session, bulk, onClose, onConfirm, isPending }: {
  session?: SessionInfo; bulk?: boolean; onClose: () => void; onConfirm: () => void; isPending: boolean
}) {
  const device = session ? parseDevice(session.deviceInfo) : null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={isPending} label="Signing out…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">{bulk ? 'Sign out all other devices?' : 'Sign out this device?'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {bulk
                  ? "Every session except this one will be signed out immediately."
                  : <>&ldquo;{device?.label}&rdquo; will be signed out immediately.</>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={isPending} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionsCard() {
  const { data: sessions = [], isLoading } = useSessions()
  const revoke = useRevokeSession()
  const revokeAll = useRevokeSessions()
  const [toRevoke, setToRevoke] = useState<SessionInfo | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const others = sessions.filter(s => !s.isCurrent)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          icon={Monitor}
          iconCls="bg-primary/10 text-primary"
          title="Active sessions"
          description="Devices currently signed in to your account."
        />
        {others.length > 0 && (
          <button
            onClick={() => setConfirmBulk(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out all others
          </button>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          // Scrolls only when there are more than 3 rows; at 3 or fewer it
          // renders at natural height with no scrollbar (same convention as
          // the dashboard's Announcements/Recent-Approvals cards).
          <div className={cn(
            'space-y-2',
            sessions.length > 3 && 'max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin pr-1',
          )}>
            {sessions.map(s => {
              const device = parseDevice(s.deviceInfo)
              const DeviceIcon = device.icon
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    s.isCurrent && 'border-primary/30 bg-primary/5',
                  )}
                >
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    s.isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    <DeviceIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate" title={s.deviceInfo ?? undefined}>{device.label}</span>
                      {s.isCurrent && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {s.ipAddress && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" /> {s.ipAddress}
                        </span>
                      )}
                      <span>Active {fmtRelative(s.lastUsedAt)}</span>
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => setToRevoke(s)}
                      className="shrink-0 rounded-md border p-2 text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
                      title="Sign out this device"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toRevoke && (
        <RevokeModal
          session={toRevoke}
          isPending={revoke.isPending}
          onClose={() => setToRevoke(null)}
          onConfirm={async () => { await revoke.mutateAsync(toRevoke.id); setToRevoke(null) }}
        />
      )}
      {confirmBulk && (
        <RevokeModal
          bulk
          isPending={revokeAll.isPending}
          onClose={() => setConfirmBulk(false)}
          onConfirm={async () => { await revokeAll.mutateAsync(others.map(s => s.id)); setConfirmBulk(false) }}
        />
      )}
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SecuritySettingsPage() {
  return (
    <div className="max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <ChangePasswordCard />
          <TwoFactorCard />
        </div>
        <SessionsCard />
      </div>
    </div>
  )
}
