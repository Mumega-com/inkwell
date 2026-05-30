/**
 * Cached Intl.NumberFormat instances to prevent expensive instantiations during renders.
 */
const formattersCache = new Map<string, Intl.NumberFormat>()

function getFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale}-${JSON.stringify(options)}`
  let formatter = formattersCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    formattersCache.set(cacheKey, formatter)
  }
  return formatter
}

export function formatCurrency(
  value: number,
  currency: string = 'CAD',
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    ...options
  }
  return getFormatter(locale, defaultOptions).format(value)
}

export function formatCompact(
  value: number,
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    notation: 'compact',
    maximumFractionDigits: 1,
    ...options
  }
  return getFormatter(locale, defaultOptions).format(value)
}

export function formatPercent(
  value: number,
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    ...options
  }
  return getFormatter(locale, defaultOptions).format(value)
}

export function formatNumber(
  value: number,
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): string {
  return getFormatter(locale, options || {}).format(value)
}
