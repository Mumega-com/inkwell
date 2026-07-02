const numberFormatterCache = new Map<string, Intl.NumberFormat>()
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getCacheKey(locale: string, options?: Record<string, unknown>): string {
  if (!options) return locale
  return `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`
}

export function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = getCacheKey(locale, options as Record<string, unknown>)
  if (!numberFormatterCache.has(key)) {
    numberFormatterCache.set(key, new Intl.NumberFormat(locale, options))
  }
  return numberFormatterCache.get(key)!
}

export function getCurrencyFormatter(locale: string, currency: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const mergedOptions = { style: 'currency', currency, ...options }
  return getNumberFormatter(locale, mergedOptions)
}

export function getDateTimeFormatter(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = getCacheKey(locale, options as Record<string, unknown>)
  if (!dateTimeFormatterCache.has(key)) {
    dateTimeFormatterCache.set(key, new Intl.DateTimeFormat(locale, options))
  }
  return dateTimeFormatterCache.get(key)!
}
