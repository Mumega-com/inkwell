const formattersCache = new Map<string, Intl.NumberFormat>()

function getCacheKey(locale: string, options: Intl.NumberFormatOptions): string {
  const sortedOptions = Object.keys(options)
    .sort()
    .reduce((acc, key) => {
      acc[key as keyof Intl.NumberFormatOptions] = options[key as keyof Intl.NumberFormatOptions] as any
      return acc
    }, {} as Intl.NumberFormatOptions)
  return `${locale}:${JSON.stringify(sortedOptions)}`
}

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = getCacheKey(locale, options)
  let formatter = formattersCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    formattersCache.set(key, formatter)
  }
  return formatter
}

export function getCurrencyFormatter(
  locale = 'en-CA',
  currency = 'CAD',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  return getNumberFormatter(locale, {
    style: 'currency',
    currency,
    ...options,
  })
}

export function getCompactFormatter(
  locale = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  return getNumberFormatter(locale, {
    notation: 'compact',
    ...options,
  })
}
