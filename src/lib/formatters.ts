/**
 * Cache `Intl.NumberFormat` to prevent CPU overhead and garbage collection during React component renders.
 */

const formattersCache = new Map<string, Intl.NumberFormat>()

/**
 * Returns a cached Intl.NumberFormat instance for currency formatting.
 */
export function getCurrencyFormatter(
  locale: string = 'en-CA',
  currency: string = 'CAD',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const key = `currency-${locale}-${currency}-${JSON.stringify(options)}`

  if (!formattersCache.has(key)) {
    formattersCache.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...options
      })
    )
  }

  return formattersCache.get(key)!
}

/**
 * Returns a cached Intl.NumberFormat instance for compact number formatting.
 */
export function getCompactFormatter(
  locale: string = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const key = `compact-${locale}-${JSON.stringify(options)}`

  if (!formattersCache.has(key)) {
    formattersCache.set(
      key,
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        ...options
      })
    )
  }

  return formattersCache.get(key)!
}

/**
 * Returns a cached Intl.NumberFormat instance for general number formatting.
 */
export function getNumberFormatter(
  locale: string = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const key = `number-${locale}-${JSON.stringify(options)}`

  if (!formattersCache.has(key)) {
    formattersCache.set(
      key,
      new Intl.NumberFormat(locale, options)
    )
  }

  return formattersCache.get(key)!
}
