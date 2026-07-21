'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader, Card, EmptyState, Skeleton, SubmitOverlay } from '@/components/ui/primitives'
import { CATEGORY_META } from '@/components/dashboard/AnnouncementsCard'
import {
  useAnnouncementFeed,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '@/lib/api/hooks/useAnnouncements'
import { useOffices } from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { AnnouncementCategory, MANUAL_ANNOUNCEMENT_CATEGORIES, UserRole } from '@hr-system/types'
import type { AnnouncementFeedItem } from '@hr-system/types'
import { cn } from '@/lib/utils'
import { Plus, X, Pencil, Trash2, AlertCircle, Clock, Megaphone, Loader2 } from 'lucide-react'

function fmtCategory(c: string) {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
}

const MAX_TITLE_LENGTH = 200

/** Friendly relative-ish date: "Today", "Yesterday", "3 days ago", else a short date. */
function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * validate.middleware.ts sends Zod failures as a JSON-stringified
 * `{ field: string[] }` map (422) — turn that into readable lines instead of
 * showing the raw JSON blob. Falls back to the plain string for any other
 * error shape, and to a "can't reach the server" message when there's no
 * response at all (matches the pattern already used by LoginForm).
 */
function parseApiError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  if (!axiosErr?.response) {
    return 'Cannot reach the server. Please check your connection and try again.'
  }
  const raw = axiosErr.response.data?.error
  if (!raw) return 'Something went wrong. Please try again.'
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>
    if (parsed && typeof parsed === 'object') {
      const lines = Object.entries(parsed).map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      if (lines.length) return lines.join('\n')
    }
  } catch {
    // Not JSON — a plain error string, use as-is.
  }
  return raw
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  )
}

function CreateAnnouncementModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { data: offices = [] } = useOffices()
  const create = useCreateAnnouncement()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>(AnnouncementCategory.GENERAL)
  const [officeId, setOfficeId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  async function handleSubmit() {
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer (currently ${title.trim().length})`)
      return
    }
    if (!body.trim()) {
      setError('Body is required')
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        category,
        officeId: isSuperAdmin && officeId ? officeId : undefined,
        expiresAt: expiresAt || undefined,
      })
      onClose()
    } catch (err) {
      setError(parseApiError(err))
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
        <SubmitOverlay show={create.isPending} label="Posting…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">New Announcement</p>
          <button onClick={onClose} disabled={create.isPending} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <fieldset disabled={create.isPending} className="contents">
          <div className="space-y-3 p-4">
            {error && <ErrorBanner message={error} />}
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <span
                  className={`text-[10px] ${title.length > MAX_TITLE_LENGTH ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                >
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the update?"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Share the details…"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {MANUAL_ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{fmtCategory(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expires (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Office</label>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.code}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t px-4 py-3">
            <button onClick={onClose} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={create.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {create.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

function EditAnnouncementModal({
  item,
  onClose,
}: {
  item: AnnouncementFeedItem
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const { data: offices = [] } = useOffices()
  const update = useUpdateAnnouncement()
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body)
  const [category, setCategory] = useState<AnnouncementCategory>(item.category)
  const [officeId, setOfficeId] = useState(item.officeId ?? '')
  const [expiresAt, setExpiresAt] = useState(item.expiresAt ? item.expiresAt.slice(0, 10) : '')
  const [error, setError] = useState('')

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  async function handleSave() {
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer (currently ${title.trim().length})`)
      return
    }
    if (!body.trim()) {
      setError('Body is required')
      return
    }
    try {
      await update.mutateAsync({
        id: item.id,
        title: title.trim(),
        body: body.trim(),
        category,
        // null clears the expiry; a date string sets it.
        expiresAt: expiresAt || null,
        // Only send officeId for a SUPER_ADMIN (null = all offices). Ignored server-side otherwise.
        ...(isSuperAdmin ? { officeId: officeId || null } : {}),
      })
      onClose()
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !update.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={update.isPending} label="Saving…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Edit Announcement</p>
          <button onClick={onClose} disabled={update.isPending} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <fieldset disabled={update.isPending} className="contents">
          <div className="space-y-3 p-4">
            {error && <ErrorBanner message={error} />}
            <div>
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <span
                  className={`text-[10px] ${title.length > MAX_TITLE_LENGTH ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                >
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {MANUAL_ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{fmtCategory(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expires (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Office</label>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.code}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t px-4 py-3">
            <button onClick={onClose} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  item,
  onClose,
}: {
  item: AnnouncementFeedItem
  onClose: () => void
}) {
  const del = useDeleteAnnouncement()
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    try {
      await del.mutateAsync(item.id)
      onClose()
    } catch (err) {
      setError(parseApiError(err))
    }
  }

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
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Delete announcement?</p>
          <button onClick={onClose} disabled={del.isPending} className="rounded-md p-1 hover:bg-muted disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {error && <ErrorBanner message={error} />}
          <p className="text-sm text-muted-foreground">
            This will permanently remove <span className="font-medium text-foreground">“{item.title}”</span>. This
            can&apos;t be undone.
          </p>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button onClick={onClose} disabled={del.isPending} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={del.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {del.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function canManage(item: AnnouncementFeedItem, userEmployeeId?: string, isSuperAdmin?: boolean): boolean {
  return item.source === 'MANUAL' && (isSuperAdmin || item.authorId === userEmployeeId)
}

function AnnouncementItem({
  item,
  manageable,
  highlighted,
  onEdit,
  onDelete,
}: {
  item: AnnouncementFeedItem
  manageable: boolean
  highlighted: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META[AnnouncementCategory.GENERAL]
  const Icon = meta.icon

  return (
    <div
      id={`ann-${item.id}`}
      className={cn(
        'flex scroll-mt-24 gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40',
        highlighted && 'border-primary ring-2 ring-primary/40'
      )}
    >
      {item.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', meta.chip)}>
          <Icon className="h-5 w-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', meta.chip)}>{meta.label}</span>
              {item.source === 'AUTO' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Automated
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug">{item.title}</p>
          </div>

          {manageable && (
            <div className="flex shrink-0 gap-1">
              <button
                onClick={onEdit}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Edit"
                aria-label="Edit announcement"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                title="Delete"
                aria-label="Delete announcement"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.body}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{fmtWhen(item.publishedAt)}</span>
          {item.source === 'MANUAL' && item.authorName && <span>· {item.authorName}</span>}
          {item.expiresAt && (
            <span className="inline-flex items-center gap-1">
              · <Clock className="h-3 w-3" /> Expires {new Date(item.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const user = useAuthStore((s) => s.user)
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const { data: items = [], isLoading } = useAnnouncementFeed()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AnnouncementFeedItem | null>(null)
  const [deleting, setDeleting] = useState<AnnouncementFeedItem | null>(null)
  const [filter, setFilter] = useState<AnnouncementCategory | 'ALL'>('ALL')
  const [flashId, setFlashId] = useState<string | null>(null)
  // Guards against re-scrolling to the same deep-linked item on every render.
  const scrolledForRef = useRef<string | null>(null)

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const canPost = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)

  // Deep link from the dashboard card (?highlight=<id>): once the feed has
  // loaded and contains the item, clear any category filter that would hide
  // it, scroll it into view, and flash a highlight ring for a couple seconds.
  useEffect(() => {
    if (!highlightId || isLoading) return
    if (scrolledForRef.current === highlightId) return
    if (!items.some((it) => it.id === highlightId)) return
    scrolledForRef.current = highlightId
    setFilter('ALL')
    setFlashId(highlightId)
    const el = document.getElementById(`ann-${highlightId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, isLoading, items])

  // Auto-clear the highlight ring 5s after it's set. Kept in its own effect
  // (keyed only on flashId) so re-runs of the scroll effect above — which
  // depends on the volatile `items` reference — can't cancel this timer.
  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), 5000)
    return () => clearTimeout(t)
  }, [flashId])

  // Category chips: "All" + only the categories actually present in the feed.
  const presentCategories = useMemo(() => {
    const seen = new Set<AnnouncementCategory>()
    for (const it of items) seen.add(it.category)
    return Array.from(seen)
  }, [items])

  const visible = useMemo(
    () => (filter === 'ALL' ? items : items.filter((it) => it.category === filter)),
    [items, filter]
  )

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company news, closures, and automatic updates."
        action={
          canPost && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          )
        }
      />

      {!isLoading && items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip label="All" count={items.length} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
          {presentCategories.map((c) => (
            <FilterChip
              key={c}
              label={CATEGORY_META[c]?.label ?? fmtCategory(c)}
              count={items.filter((it) => it.category === c).length}
              active={filter === c}
              onClick={() => setFilter(c)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl border bg-card p-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Megaphone className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No announcements yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {canPost
                ? 'Post company news, office closures, or policy updates — they’ll show up here and on everyone’s dashboard.'
                : 'Company news and updates will appear here.'}
            </p>
            {canPost && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New Announcement
              </button>
            )}
          </div>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState message="No announcements in this category." />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <AnnouncementItem
              key={item.id}
              item={item}
              manageable={canManage(item, user?.employeeId, isSuperAdmin)}
              highlighted={item.id === flashId}
              onEdit={() => setEditing(item)}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateAnnouncementModal onClose={() => setShowCreate(false)} />}
      {editing && <EditAnnouncementModal item={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirmModal item={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      )}
    >
      {label}
      <span className={cn('ml-1.5', active ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{count}</span>
    </button>
  )
}
