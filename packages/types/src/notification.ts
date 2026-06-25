import { NotificationType } from './enums'

export interface Notification {
  id: string
  employeeId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown> | null
  isRead: boolean
  readAt?: string | null
  createdAt: string
}

export interface NotificationCount {
  unread: number
}
