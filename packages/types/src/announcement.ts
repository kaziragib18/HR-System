import type { AnnouncementCategory } from './enums'

export interface AnnouncementFeedItem {
  /** Real cuid for manual rows; synthetic (e.g. `auto-birthday-<employeeId>-<yyyy-mm-dd>`) for computed ones. */
  id: string
  source: 'MANUAL' | 'AUTO'
  category: AnnouncementCategory
  title: string
  body: string
  officeId: string | null
  attachmentPath?: string | null
  authorName?: string | null
  authorId?: string | null
  publishedAt: string
  expiresAt?: string | null
  /** For person-centric AUTO items (new joinee, birthday, anniversary): the employee's avatar, shown in place of the category icon when set. */
  avatarUrl?: string | null
}
