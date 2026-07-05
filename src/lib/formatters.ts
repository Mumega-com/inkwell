const numberFormatCache = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  // Ensure consistent serialization for the cache key
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : ''

  const cacheKey = `number-${locale}-${optionsKey}`

  if (!numberFormatCache.has(cacheKey)) {
    numberFormatCache.set(cacheKey, new Intl.NumberFormat(locale, options))
  }

  return numberFormatCache.get(cacheKey)!
}

export function getCurrencyFormatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  }

  const optionsKey = JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort())
  const cacheKey = `currency-${locale}-${optionsKey}`

  if (!numberFormatCache.has(cacheKey)) {
    numberFormatCache.set(cacheKey, new Intl.NumberFormat(locale, mergedOptions))
  }

  return numberFormatCache.get(cacheKey)!
}
