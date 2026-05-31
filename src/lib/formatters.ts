/**
 * Caches for expensive Intl instances to avoid CPU overhead and garbage collection
 * during frequent React renders.
 */

// Cache for currency formatters (keyed by locale + currency + maxFractionDigits)
const currencyFormatterCache = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(
  locale: string,
  currency: string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): Intl.NumberFormat {
  // Use a predictable cache key
  const minKey = options?.minimumFractionDigits !== undefined ? `_min${options.minimumFractionDigits}` : ''
  const maxKey = options?.maximumFractionDigits !== undefined ? `_max${options.maximumFractionDigits}` : ''
  const key = `${locale}_${currency}${minKey}${maxKey}`

  if (!currencyFormatterCache.has(key)) {
    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
    }

    // Only set fraction digits if explicitly provided to avoid
    // RangeError: maximumFractionDigits value is out of range
    if (options?.minimumFractionDigits !== undefined) {
      formatOptions.minimumFractionDigits = options.minimumFractionDigits
    }
    if (options?.maximumFractionDigits !== undefined) {
      formatOptions.maximumFractionDigits = options.maximumFractionDigits
    }

    currencyFormatterCache.set(key, new Intl.NumberFormat(locale, formatOptions))
  }

  return currencyFormatterCache.get(key)!
}

// Cache for compact formatters (keyed by locale + maxFractionDigits)
const compactFormatterCache = new Map<string, Intl.NumberFormat>()

export function getCompactFormatter(
  locale: string,
  options?: { maximumFractionDigits?: number }
): Intl.NumberFormat {
  const maxKey = options?.maximumFractionDigits !== undefined ? `_max${options.maximumFractionDigits}` : ''
  const key = `${locale}${maxKey}`

  if (!compactFormatterCache.has(key)) {
    const formatOptions: Intl.NumberFormatOptions = {
      notation: 'compact',
    }

    if (options?.maximumFractionDigits !== undefined) {
      formatOptions.maximumFractionDigits = options.maximumFractionDigits
    }

    compactFormatterCache.set(key, new Intl.NumberFormat(locale, formatOptions))
  }

  return compactFormatterCache.get(key)!
}
