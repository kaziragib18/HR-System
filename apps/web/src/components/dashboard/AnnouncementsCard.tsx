'use client'

import Link from 'next/link'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { useAnnouncementFeed } from '@/lib/api/hooks/useAnnouncements'
import { AnnouncementCategory, type AnnouncementFeedItem } from '@hr-system/types'
import { cn } from '@/lib/utils'
import {
  Megaphone,
  DoorClosed,
  PartyPopper,
  Award,
  UserPlus,
  FileText,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'

interface CategoryMeta {
  icon: LucideIcon
  label: string
  /** icon chip background + foreground */
  chip: string
}

export const CATEGORY_META: Record<AnnouncementCategory, CategoryMeta> = {
  [AnnouncementCategory.GENERAL]: {
    icon: Megaphone,
    label: 'General',
    chip: 'bg-primary/10 text-primary',
  },
  [AnnouncementCategory.OFFICE_CLOSURE]: {
    icon: DoorClosed,
    label: 'Office Closure',
    chip: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  },
  [AnnouncementCategory.OTHER]: {
    icon: Megaphone,
    label: 'Other',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  },
  [AnnouncementCategory.NEW_JOINEE]: {
    icon: UserPlus,
    label: 'New Joinee',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  [AnnouncementCategory.BIRTHDAY]: {
    icon: PartyPopper,
    label: 'Birthday',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  },
  [AnnouncementCategory.WORK_ANNIVERSARY]: {
    icon: Award,
    label: 'Work Anniversary',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  [AnnouncementCategory.POLICY_DOCUMENT]: {
    icon: FileText,
    label: 'Policy Document',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  [AnnouncementCategory.UPCOMING_HOLIDAY]: {
    icon: CalendarClock,
    label: 'Upcoming Holiday',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function AnnouncementRow({ item }: { item: AnnouncementFeedItem }) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META[AnnouncementCategory.GENERAL]
  const Icon = meta.icon
  return (
    // Deep-link to the full page, scrolling to + highlighting this exact item.
    <Link
      href={`/announcements?highlight=${encodeURIComponent(item.id)}`}
      className="-mx-1 flex items-start gap-2.5 rounded-md border-b px-1 py-2.5 last:border-0 hover:bg-muted/50"
    >
      {item.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.avatarUrl} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', meta.chip)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.body}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {fmtDate(item.publishedAt)}
          {item.source === 'MANUAL' && item.authorName ? ` · ${item.authorName}` : ''}
        </p>
      </div>
    </Link>
  )
}

export function AnnouncementsCard() {
  const { data: items = [], isLoading } = useAnnouncementFeed()

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Announcements</p>
        <Link href="/announcements" className="text-xs font-medium text-primary hover:underline">
          View all →
        </Link>
      </div>
      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="No announcements right now." />
      ) : (
        // ~3 rows visible; scrolls (themed thin scrollbar) when there are more.
        <div className="max-h-[210px] overflow-y-auto overflow-x-hidden scrollbar-thin pr-1">
          {items.map((item) => (
            <AnnouncementRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  )
}
