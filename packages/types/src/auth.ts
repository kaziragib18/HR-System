import { UserRole, type Theme } from './enums'

export interface AuthUser {
  id: string
  employeeId: string
  email: string
  role: UserRole
  officeId: string
  officeCode: string
  officeWorkStartTime: string
  officeWorkEndTime: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  isTwoFactorEnabled?: boolean
  departmentId?: string | null
  departmentName?: string | null
  theme: Theme
}

export interface AuthTokens {
  accessToken: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
  accessToken: string
  requiresTwoFactor?: boolean
  tempToken?: string
}

export interface TwoFactorVerifyRequest {
  tempToken: string
  code: string
}

export interface RefreshResponse {
  accessToken: string
}

export interface SessionInfo {
  id: string
  deviceInfo?: string | null
  ipAddress?: string | null
  createdAt: string
  lastUsedAt: string
  isCurrent: boolean
}
