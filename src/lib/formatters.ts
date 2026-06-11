const currencyFormatters = new Map<string, Intl.NumberFormat>()
const compactFormatters = new Map<string, Intl.NumberFormat>()

/**
 * Returns a cached Intl.NumberFormat instance for currency formatting.
 * Caching these instances prevents significant CPU overhead during renders.
 */
export function getCurrencyFormatter(
  locale = 'en-CA',
  currency = 'CAD',
  minimumFractionDigits?: number,
  maximumFractionDigits?: number
): Intl.NumberFormat {
  // Create a cache key based on the options provided
  const key = `${locale}-${currency}-${minimumFractionDigits ?? ''}-${maximumFractionDigits ?? ''}`

  if (!currencyFormatters.has(key)) {
    const options: Intl.NumberFormatOptions = { style: 'currency', currency }
    if (minimumFractionDigits !== undefined) {
      options.minimumFractionDigits = minimumFractionDigits
    }
    if (maximumFractionDigits !== undefined) {
      options.maximumFractionDigits = maximumFractionDigits
    }
    currencyFormatters.set(key, new Intl.NumberFormat(locale, options))
  }

  return currencyFormatters.get(key)!
}

/**
 * Returns a cached Intl.NumberFormat instance for compact number formatting.
 * Caching these instances prevents significant CPU overhead during renders.
 */
export function getCompactFormatter(
  locale = 'en-CA',
  maximumFractionDigits?: number
): Intl.NumberFormat {
  const key = `${locale}-${maximumFractionDigits ?? ''}`

  if (!compactFormatters.has(key)) {
    const options: Intl.NumberFormatOptions = { notation: 'compact' }
    if (maximumFractionDigits !== undefined) {
      options.maximumFractionDigits = maximumFractionDigits
    }
    compactFormatters.set(key, new Intl.NumberFormat(locale, options))
  }

  return compactFormatters.get(key)!
}
