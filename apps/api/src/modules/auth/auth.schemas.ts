import { z } from 'zod'
import { THEME_VALUES } from '@hr-system/types'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const twoFactorVerifySchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().length(6),
})

export const twoFactorEnableSchema = z.object({
  code: z.string().length(6),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const updateThemeSchema = z.object({
  theme: z.enum(THEME_VALUES),
})

export type LoginInput = z.infer<typeof loginSchema>
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>
