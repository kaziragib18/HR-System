import { Currency } from '@hr-system/types'

const CURRENCY_LOCALES: Record<Currency, { locale: string; currency: string }> = {
  [Currency.BDT]: { locale: 'bn-BD', currency: 'BDT' },
  [Currency.GBP]: { locale: 'en-GB', currency: 'GBP' },
}

export function formatCurrency(amount: number, currency: Currency | string): string {
  const config = CURRENCY_LOCALES[currency as Currency]
  if (!config) return `${currency} ${amount.toFixed(2)}`
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 2,
  }).format(amount)
}
