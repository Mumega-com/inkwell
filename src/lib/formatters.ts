/**
 * Cache for Intl.NumberFormat instances.
 * Instantiating Intl.NumberFormat is a relatively expensive CPU operation.
 * Caching these instances avoids unnecessary overhead during React component renders.
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>()

/**
 * Gets or creates a cached Intl.NumberFormat instance.
 */
function getCachedNumberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  // Use a stringified version of the options as the cache key
  const key = `${locale}-${JSON.stringify(options)}`

  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatCache.set(key, formatter)
  }

  return formatter
}

/**
 * Returns a cached Intl.NumberFormat for currency formatting.
 * Note: Do not set restrictive default options like maximumFractionDigits: 0
 * as they can conflict with overrides like minimumFractionDigits: 2.
 */
export function getCurrencyFormatter(
  locale: string = 'en-CA',
  currency: string = 'CAD',
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  return getCachedNumberFormat(locale, {
    style: 'currency',
    currency,
    ...options
  })
}

/**
 * Returns a cached Intl.NumberFormat for compact notation formatting.
 */
export function getCompactFormatter(
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  return getCachedNumberFormat(locale, {
    notation: 'compact',
    ...options
  })
}
