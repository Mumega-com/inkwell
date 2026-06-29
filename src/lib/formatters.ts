const numberFormatCache = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatCache.set(key, formatter)
  }
  return formatter
}

export function getCurrencyFormatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return getNumberFormatter(locale, { style: 'currency', currency, ...options })
}
