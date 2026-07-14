'use client'

import Link from 'next/link'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { useAnnouncementFeed } from '@/lib/api/hooks/useAnnouncements'
import { AnnouncementCategory, type AnnouncementFeedItem } from '@hr-system/types'
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

const CATEGORY_ICON: Record<AnnouncementCategory, LucideIcon> = {
  [AnnouncementCategory.GENERAL]: Megaphone,
  [AnnouncementCategory.OFFICE_CLOSURE]: DoorClosed,
  [AnnouncementCategory.OTHER]: Megaphone,
  [AnnouncementCategory.NEW_JOINEE]: UserPlus,
  [AnnouncementCategory.BIRTHDAY]: PartyPopper,
  [AnnouncementCategory.WORK_ANNIVERSARY]: Award,
  [AnnouncementCategory.POLICY_DOCUMENT]: FileText,
  [AnnouncementCategory.UPCOMING_HOLIDAY]: CalendarClock,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function AnnouncementRow({ item }: { item: AnnouncementFeedItem }) {
  const Icon = CATEGORY_ICON[item.category] ?? Megaphone
  return (
    <div className="flex items-start gap-2.5 border-b py-2.5 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.body}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {fmtDate(item.publishedAt)}
          {item.source === 'MANUAL' && item.authorName ? ` · ${item.authorName}` : ''}
        </p>
      </div>
    </div>
  )
}

export function AnnouncementsCard() {
  const { data: items = [], isLoading } = useAnnouncementFeed()
  const preview = items.slice(0, 5)

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
      ) : preview.length === 0 ? (
        <EmptyState message="No announcements right now." />
      ) : (
        <div>
          {preview.map((item) => (
            <AnnouncementRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  )
}
