const cache = new Map<string, Intl.NumberFormat>()

export function getFormatter(
  locale: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options)}`
  let formatter = cache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    cache.set(key, formatter)
  }
  return formatter
}

export function formatCurrency(
  value: number,
  locale = 'en-CA',
  currency = 'CAD',
  options?: Intl.NumberFormatOptions
): string {
  return getFormatter(locale, { style: 'currency', currency, ...options }).format(value)
}

export function formatCompact(
  value: number,
  locale = 'en-CA',
  options?: Intl.NumberFormatOptions
): string {
  return getFormatter(locale, { notation: 'compact', ...options }).format(value)
}
