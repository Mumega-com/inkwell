// Cached instances of Intl formatters to avoid unnecessary garbage collection overhead

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  // We sort keys to ensure stable cache key for the same options
  const cacheKey = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options))
  }
  return formatterCache.get(cacheKey)!
}

const formatterCache = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return getNumberFormatter(locale, { style: 'currency', currency, ...options })
}
