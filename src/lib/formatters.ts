const cache = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(options: Intl.NumberFormatOptions & { locale?: string }): Intl.NumberFormat {
  const { locale = 'en-CA', ...rest } = options
  const key = `currency:${locale}:${JSON.stringify(rest)}`
  let formatter = cache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', ...rest })
    cache.set(key, formatter)
  }
  return formatter
}

export function getNumberFormatter(options: Intl.NumberFormatOptions & { locale?: string } = {}): Intl.NumberFormat {
  const { locale = 'en-CA', ...rest } = options
  const key = `number:${locale}:${JSON.stringify(rest)}`
  let formatter = cache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, rest)
    cache.set(key, formatter)
  }
  return formatter
}
