const cache = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(locale: string = 'en-CA', options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `number:${locale}:${JSON.stringify(options, Object.keys(options).sort())}`
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat(locale, options))
  }
  return cache.get(key)!
}

export function getCurrencyFormatter(locale: string = 'en-CA', options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  // Ensure we set style to currency, but don't hardcode restricting fraction digits.
  const mergedOptions = { style: 'currency', currency: 'CAD', ...options }
  const key = `currency:${locale}:${JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort())}`
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat(locale, mergedOptions))
  }
  return cache.get(key)!
}
