const formatters = new Map<string, Intl.NumberFormat>()

/**
 * Gets a cached currency formatter.
 * Note: Avoid setting maximumFractionDigits to 0 here as a default,
 * because it can conflict with minimumFractionDigits > 0 overrides and cause a RangeError.
 */
export function getCurrencyFormatter(locale = 'en-CA', currency = 'CAD', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `currency-${locale}-${currency}-${JSON.stringify(options || {})}`

  if (!formatters.has(cacheKey)) {
    const defaultOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
    }

    // Merge options carefully to avoid RangeError
    const mergedOptions = { ...defaultOptions, ...options }
    formatters.set(cacheKey, new Intl.NumberFormat(locale, mergedOptions))
  }

  return formatters.get(cacheKey)!
}

/**
 * Gets a cached compact number formatter.
 */
export function getCompactFormatter(locale = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `compact-${locale}-${JSON.stringify(options || {})}`

  if (!formatters.has(cacheKey)) {
    const defaultOptions: Intl.NumberFormatOptions = {
      notation: 'compact',
    }

    const mergedOptions = { ...defaultOptions, ...options }
    formatters.set(cacheKey, new Intl.NumberFormat(locale, mergedOptions))
  }

  return formatters.get(cacheKey)!
}

/**
 * Gets a basic number formatter.
 */
export function getNumberFormatter(locale = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `number-${locale}-${JSON.stringify(options || {})}`

  if (!formatters.has(cacheKey)) {
    formatters.set(cacheKey, new Intl.NumberFormat(locale, options))
  }

  return formatters.get(cacheKey)!
}
