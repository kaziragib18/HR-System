import { LIGHT_THEMES, DARK_THEMES, type Theme } from '@hr-system/types'

export type LightVariant = (typeof LIGHT_THEMES)[number]
export type DarkVariant = (typeof DARK_THEMES)[number]
export type { Theme }

export const THEME_STORAGE_KEY = 'hr-theme'
export const LAST_LIGHT_STORAGE_KEY = 'hr-theme-last-light'
export const LAST_DARK_STORAGE_KEY = 'hr-theme-last-dark'

export const LIGHT_VARIANTS: LightVariant[] = [...LIGHT_THEMES]
export const DARK_VARIANTS: DarkVariant[] = [...DARK_THEMES]

export function isDarkVariant(t: string): t is DarkVariant {
  return (DARK_VARIANTS as string[]).includes(t)
}

export function isTheme(t: string): t is Theme {
  return (LIGHT_VARIANTS as string[]).includes(t) || isDarkVariant(t)
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', isDarkVariant(theme))
  if (theme === 'light' || theme === 'dark') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }
}

export const LIGHT_THEME_SWATCHES: { id: LightVariant; label: string; gradient: string }[] = [
  { id: 'light',   label: 'Light',   gradient: 'linear-gradient(135deg, #daeeff 0%, #f9fbfc 60%)' },
  { id: 'forest',  label: 'Forest',  gradient: 'linear-gradient(135deg, #cce8c2 0%, #f4f7f2 60%)' },
  { id: 'ocean',   label: 'Ocean',   gradient: 'linear-gradient(135deg, #a0d8f0 0%, #f2f8fa 60%)' },
  { id: 'ice-age', label: 'Ice Age', gradient: 'linear-gradient(135deg, #b8c8f8 0%, #f5f7fb 60%)' },
  { id: 'desert',  label: 'Desert',  gradient: 'linear-gradient(135deg, #f0d890 0%, #faf7f2 60%)' },
  { id: 'autumn',  label: 'Autumn',  gradient: 'linear-gradient(135deg, #f0a870 0%, #faf5f0 60%)' },
  { id: 'blossom', label: 'Blossom', gradient: 'linear-gradient(135deg, #f4a0bc 0%, #fdf4f7 60%)' },
]

export const DARK_THEME_SWATCHES: { id: DarkVariant; label: string; gradient: string }[] = [
  { id: 'dark',       label: 'Dark',       gradient: 'linear-gradient(135deg, #2db49b 0%, #1a2030 70%)' },
  { id: 'midnight',   label: 'Midnight',   gradient: 'linear-gradient(135deg, #3a7aff 0%, #0d1520 70%)' },
  { id: 'amoled',     label: 'AMOLED',     gradient: 'linear-gradient(135deg, #00d4ff 0%, #000000 70%)' },
  { id: 'mocha',      label: 'Mocha',      gradient: 'linear-gradient(135deg, #e08848 0%, #1a1008 70%)' },
  { id: 'slate',      label: 'Slate',      gradient: 'linear-gradient(135deg, #60a8d0 0%, #182230 70%)' },
  { id: 'dracula',    label: 'Dracula',    gradient: 'linear-gradient(135deg, #bd8aff 0%, #1a1628 70%)' },
  { id: 'monochrome', label: 'Monochrome', gradient: 'linear-gradient(135deg, #d0d0d0 0%, #111111 70%)' },
]
