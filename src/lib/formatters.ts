/**
 * Utilities for formatting numbers and currencies using cached `Intl.NumberFormat` instances.
 * Instantiating `Intl.NumberFormat` is an expensive operation and can cause performance bottlenecks
 * if executed inside tight render loops (e.g. in React components). These cached helpers
 * optimize formatting calls.
 */

const numberFormatCache = new Map<string, Intl.NumberFormat>()

/**
 * Returns a cached `Intl.NumberFormat` instance for general numbers.
 */
export function getNumberFormatter(locale: string = 'en-CA', options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  // Generate a deterministic cache key by sorting the keys of the options object
  const sortedOptionsStr = JSON.stringify(options, Object.keys(options).sort())
  const cacheKey = `number:${locale}:${sortedOptionsStr}`

  let formatter = numberFormatCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatCache.set(cacheKey, formatter)
  }

  return formatter
}

/**
 * Returns a cached `Intl.NumberFormat` instance specifically for currencies.
 */
export function getCurrencyFormatter(currency: string = 'CAD', locale: string = 'en-CA', options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  }

  const sortedOptionsStr = JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort())
  const cacheKey = `currency:${locale}:${sortedOptionsStr}`

  let formatter = numberFormatCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, mergedOptions)
    numberFormatCache.set(cacheKey, formatter)
  }

  return formatter
}
