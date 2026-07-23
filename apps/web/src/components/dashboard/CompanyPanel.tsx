'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import {
  useOffices,
  useAllOffices,
  useCreateOffice,
  useUpdateOffice,
  useDeactivateOffice,
  useReactivateOffice,
  type Office,
  type CreateOfficeInput,
} from '@/lib/api/hooks/useReference'
import { Card, Skeleton, SubmitOverlay } from '@/components/ui/primitives'
import {
  Building2,
  Check,
  Upload,
  Trash2,
  FileText,
  ExternalLink,
  ImagePlus,
  AlertTriangle,
  Loader2,
  Plus,
  RotateCcw,
  X,
  Globe,
  Banknote,
  Clock,
  MapPin,
  Phone,
  Mail,
  Link2,
  ChevronDown,
  ChevronRight,
  Archive,
  FileImage,
  FileSpreadsheet,
  Presentation,
  UploadCloud,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ─── Shared field styling ─────────────────────────────────────────────────────

const fieldCls =
  'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const iconFieldCls =
  'w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground'

const TIMEZONE_OPTIONS: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

const CURRENCY_OPTIONS = [
  'USD',
  'GBP',
  'EUR',
  'BDT',
  'INR',
  'PKR',
  'LKR',
  'AED',
  'SAR',
  'SGD',
  'AUD',
  'CAD',
  'JPY',
  'CNY',
  'MYR',
  'PHP',
  'ZAR',
  'NGN',
  'KES',
]

/** A small icon-chip + label, grouping a cluster of related fields — mirrors
 * the bg-primary/10 icon-chip convention already used for section icons
 * elsewhere in the app (e.g. departments page), just scaled down for form use. */
function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof Globe
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
        <Icon className="h-3 w-3" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

/** Maps a document's mimetype to a scannable icon + color chip, so the compliance-docs
 * list doesn't render every file type as an identical generic FileText/primary icon. */
function docTypeMeta(mimeType?: string | null): { icon: typeof FileText; className: string } {
  if (mimeType?.startsWith('image/'))
    return { icon: FileImage, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }
  if (mimeType === 'application/pdf')
    return { icon: FileText, className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' }
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel'))
    return {
      icon: FileSpreadsheet,
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    }
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint'))
    return { icon: Presentation, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
  if (mimeType?.includes('word'))
    return { icon: FileText, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' }
  return { icon: FileText, className: 'bg-primary/10 text-primary' }
}

/** A text input with a small leading icon, for fields that benefit from a quick visual scan. */
function IconInput({
  icon: Icon,
  ...props
}: { icon: typeof Globe } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input {...props} className={iconFieldCls} />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceDoc {
  id: string
  title: string
  description?: string | null
  storagePath: string
  mimeType?: string | null
  fileSize?: number | null
  createdAt: string
  uploadedBy: { id: string; firstName: string; lastName: string }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useComplianceDocs() {
  return useQuery({
    queryKey: ['compliance-docs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/compliance-docs')
      return data.data as ComplianceDoc[]
    },
  })
}

// ─── Office Info Form ─────────────────────────────────────────────────────────

function OfficeForm({ office }: { office: Office }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: office.name,
    country: office.country,
    currency: office.currency,
    timezone: office.timezone,
    workStartTime: office.workStartTime,
    workEndTime: office.workEndTime,
    address: office.address ?? '',
    phone: office.phone ?? '',
    email: office.email ?? '',
    website: office.website ?? '',
    showOnClock: office.showOnClock,
  })
  // Snapshot of the last-saved values, used only to detect unsaved changes —
  // showOnClock is deliberately excluded since it auto-saves on click and
  // should never make the main "Save changes" button dirty/enabled.
  const savedFormRef = useRef(form)
  const isDirty = (Object.keys(form) as (keyof typeof form)[]).some(
    (key) => key !== 'showOnClock' && form[key] !== savedFormRef.current[key]
  )

  const [saved, setSaved] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(office.logoUrl ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

  const update = useUpdateOffice()
  const clockUpdate = useUpdateOffice()
  const [clockSaved, setClockSaved] = useState(false)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')
    setLogoPreview(URL.createObjectURL(file))
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await apiClient.post(`/company/offices/${office.id}/logo`, fd)
      setLogoPreview(data.data.logoUrl)
      qc.invalidateQueries({ queryKey: ['offices'] })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Logo upload failed'
      setLogoError(msg)
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isDirty) return
        update.mutate(
          { id: office.id, ...form },
          {
            onSuccess: () => {
              savedFormRef.current = form
              setSaved(true)
              setTimeout(() => setSaved(false), 2500)
            },
          }
        )
      }}
      className="space-y-6"
    >
      {/* Logo + identity */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {logoPreview ? (
            <Image
              src={logoPreview}
              alt="Company logo"
              fill
              className="object-contain p-1"
              unoptimized
            />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
            {logoUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            ) : (
              <ImagePlus className="h-5 w-5 text-foreground" />
            )}
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoChange}
            disabled={logoUploading}
          />
        </label>
        <div className="flex-1 space-y-1">
          <p className="text-[11px] text-muted-foreground">
            PNG, JPG, SVG or WebP · max 5 MB · hover the logo to change it
          </p>
          {logoError && <p className="text-[11px] text-destructive">{logoError}</p>}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Office Name</label>
              <input
                className={fieldCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Office Code</label>
              <input
                className={cn(fieldCls, 'bg-muted/40 text-muted-foreground')}
                value={office.code}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regional settings */}
      <div>
        <SectionHeading icon={Globe}>Regional Settings</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Country</label>
            <input
              className={fieldCls}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <IconInput
              icon={Banknote}
              list="currency-options"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
              placeholder="e.g. USD"
            />
          </div>
          <div>
            <label className={labelCls}>Timezone</label>
            <IconInput
              icon={Globe}
              list="timezone-options"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="e.g. America/New_York"
            />
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div>
        <SectionHeading icon={MapPin}>Contact Details</SectionHeading>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Address</label>
            <textarea
              className={cn(fieldCls, 'min-h-[72px] resize-none')}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full office address…"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Phone</label>
              <IconInput
                icon={Phone}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+880 2 xxxxxxxx"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <IconInput
                type="email"
                icon={Mail}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="office@company.com"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <IconInput
              icon={Link2}
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://www.company.com"
            />
          </div>
        </div>
      </div>

      {/* Shift timing */}
      <div className="rounded-lg border p-3">
        <SectionHeading icon={Clock}>Shift Timing</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Work start time</label>
            <input
              type="time"
              className={fieldCls}
              value={form.workStartTime}
              onChange={(e) => setForm((f) => ({ ...f, workStartTime: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Work end time</label>
            <input
              type="time"
              className={fieldCls}
              value={form.workEndTime}
              onChange={(e) => setForm((f) => ({ ...f, workEndTime: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Controls check-in/check-out lateness, overtime, and every shift-hours display for this
          office&apos;s employees. Only affects attendance computed after saving — past records keep
          their already-computed status.
        </p>
      </div>

      {/* Dashboard clock */}
      <div className="rounded-lg border p-3">
        <SectionHeading icon={Clock}>Dashboard Clock</SectionHeading>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showOnClock}
            disabled={clockUpdate.isPending}
            onChange={(e) => {
              const showOnClock = e.target.checked
              setForm((f) => ({ ...f, showOnClock }))
              // Auto-saves immediately — this is a shared, company-wide setting,
              // not part of the rest of the form's "Save changes" flow.
              clockUpdate.mutate(
                { id: office.id, showOnClock },
                {
                  onSuccess: () => {
                    savedFormRef.current = { ...savedFormRef.current, showOnClock }
                    setClockSaved(true)
                    setTimeout(() => setClockSaved(false), 2000)
                  },
                  onError: () => setForm((f) => ({ ...f, showOnClock: !showOnClock })),
                }
              )
            }}
            className="h-4 w-4 rounded border-muted-foreground/40 text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          Show this office&apos;s live clock on everyone&apos;s dashboard
          {clockUpdate.isPending && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
          {clockSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </label>
        {clockUpdate.isError && (
          <p className="mt-1 text-xs text-destructive">
            {(clockUpdate.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              'Failed to save'}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Every employee and admin dashboard shows a real-time clock for each office that has this
          turned on. Turning it off here hides it for everyone — this isn&apos;t a per-person preference.
        </p>
      </div>

      {update.isError && (
        <p className="text-xs text-destructive">
          {(update.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Failed to save'}
        </p>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={update.isPending || !isDirty}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : update.isPending ? (
            'Saving…'
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  )
}

// ─── Add Office modal ─────────────────────────────────────────────────────────

function AddOfficeModal({ onClose }: { onClose: () => void }) {
  const create = useCreateOffice()
  const [form, setForm] = useState({
    code: '',
    name: '',
    country: '',
    currency: '',
    timezone: '',
    workStartTime: '09:00',
    workEndTime: '17:00',
  })
  const [error, setError] = useState('')

  const canSubmit =
    form.code.trim() &&
    form.name.trim() &&
    form.country.trim() &&
    form.currency.trim() &&
    form.timezone.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    try {
      const payload: CreateOfficeInput = { ...form, code: form.code.trim().toUpperCase() }
      await create.mutateAsync(payload)
      onClose()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to create office'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !create.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={create.isPending} label="Creating…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Add Office</p>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Code</label>
              <input
                className={fieldCls}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. US"
                maxLength={10}
              />
            </div>
            <div>
              <label className={labelCls}>Name</label>
              <input
                className={fieldCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Company name"
              />
            </div>
          </div>
          <div>
            <SectionHeading icon={Globe}>Regional Settings</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Country</label>
                <input
                  className={fieldCls}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="United States"
                />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <IconInput
                  icon={Banknote}
                  list="currency-options"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                  }
                  placeholder="USD"
                />
              </div>
              <div>
                <label className={labelCls}>Timezone</label>
                <IconInput
                  icon={Globe}
                  list="timezone-options"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="America/New_York"
                />
              </div>
            </div>
          </div>
          <div>
            <SectionHeading icon={Clock}>Shift Timing</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Work start time</label>
                <input
                  type="time"
                  className={fieldCls}
                  value={form.workStartTime}
                  onChange={(e) => setForm((f) => ({ ...f, workStartTime: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Work end time</label>
                <input
                  type="time"
                  className={fieldCls}
                  value={form.workEndTime}
                  onChange={(e) => setForm((f) => ({ ...f, workEndTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Payroll tax calculation is only implemented for the existing BD/UK offices today —
            running payroll for a new office will show a clear error until engineering adds real
            tax-law support for it.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={create.isPending}
              className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || create.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {create.isPending ? 'Creating…' : 'Create office'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Remove office confirm modal ──────────────────────────────────────────────

function RemoveOfficeConfirmModal({ office, onClose }: { office: Office; onClose: () => void }) {
  const deactivate = useDeactivateOffice()
  const [error, setError] = useState('')

  async function handleConfirm() {
    setError('')
    try {
      await deactivate.mutateAsync(office.id)
      onClose()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to remove office'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !deactivate.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={deactivate.isPending} label="Removing…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">Remove {office.name}?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This hides {office.code} and every office-scoped filter/picker across the app until
                it&apos;s added back. Blocked if any active employees remain in this office.
              </p>
            </div>
          </div>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={deactivate.isPending}
              className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deactivate.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deactivate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deactivate.isPending ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Inactive offices (compact disclosure) ────────────────────────────────────

function InactiveOffices() {
  const { data: allOffices } = useAllOffices()
  const reactivate = useReactivateOffice()
  const [open, setOpen] = useState(false)
  const inactive = (allOffices ?? []).filter((o) => !o.isActive)

  if (inactive.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Archive className="h-3.5 w-3.5" />
        {inactive.length} inactive {inactive.length === 1 ? 'office' : 'offices'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {inactive.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {o.code} — {o.name}
              </span>
              <button
                onClick={() => reactivate.mutate(o.id)}
                disabled={reactivate.isPending}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                Reactivate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteDocConfirmModal({ doc, onClose }: { doc: ComplianceDoc; onClose: () => void }) {
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const del = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/company/compliance-docs/${doc.id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-docs'] })
      onClose()
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to delete document'
      )
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !del.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={del.isPending} label="Deleting…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">Delete document?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This will permanently remove{' '}
                <span className="font-medium text-foreground">&ldquo;{doc.title}&rdquo;</span>. This
                can&apos;t be undone.
              </p>
            </div>
          </div>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={del.isPending}
              className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {del.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {del.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Compliance Docs Section ──────────────────────────────────────────────────

function fmtFileSize(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED_DOC_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg'

// ─── Upload document modal ────────────────────────────────────────────────────

function UploadDocModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file as File)
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      await apiClient.post('/company/compliance-docs', fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-docs'] })
      onClose()
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (err as Error).message ??
          'Upload failed'
      )
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return
    setError('')
    upload.mutate()
  }

  const FileIcon = file ? docTypeMeta(file.type).icon : UploadCloud

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !upload.isPending && onClose()}>
      <div className="relative w-full max-w-md rounded-xl border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <SubmitOverlay show={upload.isPending} label="Uploading…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Upload Compliance Document</p>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              className={fieldCls}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Employee Handbook 2026"
            />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <input
              className={fieldCls}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description…"
            />
          </div>
          <div>
            <label className={labelCls}>File</label>
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) setFile(dropped)
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:bg-muted/40'
              )}
            >
              <FileIcon className={cn('h-6 w-6', file ? '' : 'text-muted-foreground/60')} />
              {file ? (
                <>
                  <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtFileSize(file.size)} · click or drop to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint, text, or image</p>
                </>
              )}
              <input
                type="file"
                accept={ACCEPTED_DOC_TYPES}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" /> Remove file
              </button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={upload.isPending} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || !title.trim() || upload.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {upload.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Compliance Docs Section ──────────────────────────────────────────────────

function ComplianceDocs() {
  const { data: docs = [], isLoading } = useComplianceDocs()
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ComplianceDoc | null>(null)

  async function handleDownload(id: string) {
    const { data } = await apiClient.get(`/company/compliance-docs/${id}/download-url`)
    window.open(data.data.downloadUrl, '_blank')
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-tight">Compliance Documents</h2>
            <p className="text-xs text-muted-foreground">Visible to all employees on their dashboard</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Document
        </button>
      </div>

      <Card>
        <p className="mb-3 text-sm font-medium">All Documents ({docs.length})</p>
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-6 w-14 shrink-0" />
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No compliance documents uploaded yet.</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" /> Upload the first one
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {docs.map((doc) => {
              const { icon: DocIcon, className: docIconCls } = docTypeMeta(doc.mimeType)
              return (
                <div
                  key={doc.id}
                  className="-mx-1 flex items-start gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', docIconCls)}>
                    <DocIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {doc.fileSize && ` · ${fmtFileSize(doc.fileSize)}`}
                      {` · by ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Download"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {showUpload && <UploadDocModal onClose={() => setShowUpload(false)} />}
      {deleteTarget && (
        <DeleteDocConfirmModal doc={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function CompanyPanelSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <Skeleton className="h-16 w-full rounded-md" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </Card>
      </div>
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card>
          <Skeleton className="h-24 w-full rounded-md" />
        </Card>
      </div>
    </div>
  )
}

export function CompanyPanel() {
  const { data: offices, isLoading } = useOffices()
  const [activeOffice, setActiveOffice] = useState(0)
  const [showAddOffice, setShowAddOffice] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Office | null>(null)

  if (isLoading) return <CompanyPanelSkeleton />

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Shared datalists — referenced by both OfficeForm and AddOfficeModal via list=, kept
          singular here since duplicate ids would conflict if each form rendered its own. */}
      <datalist id="timezone-options">
        {TIMEZONE_OPTIONS.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      <datalist id="currency-options">
        {CURRENCY_OPTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Office info section */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold">Office Information</h2>
          </div>
          <button
            onClick={() => setShowAddOffice(true)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Office
          </button>
        </div>

        <div className="mb-4 mt-2">
          <InactiveOffices />
        </div>

        {offices && offices.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {offices.map((o, i) => (
              <div
                key={o.id}
                className={cn(
                  'group/pill flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1.5 text-sm font-medium transition-colors',
                  activeOffice === i
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border hover:bg-muted'
                )}
              >
                <button onClick={() => setActiveOffice(i)}>
                  {o.code} — {o.name}
                </button>
                {!o.isDefault && (
                  <button
                    onClick={() => setRemoveTarget(o)}
                    title="Remove office"
                    className={cn(
                      'rounded-full p-0.5 opacity-40 transition-opacity group-hover/pill:opacity-100',
                      activeOffice === i
                        ? 'hover:bg-primary-foreground/20'
                        : 'hover:bg-destructive/10 hover:text-destructive'
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {offices && offices[activeOffice] && (
          <Card>
            <OfficeForm key={offices[activeOffice].id} office={offices[activeOffice]} />
          </Card>
        )}
      </div>

      {showAddOffice && <AddOfficeModal onClose={() => setShowAddOffice(false)} />}
      {removeTarget && (
        <RemoveOfficeConfirmModal office={removeTarget} onClose={() => setRemoveTarget(null)} />
      )}

      {/* Compliance documents */}
      <ComplianceDocs />
    </div>
  )
}
