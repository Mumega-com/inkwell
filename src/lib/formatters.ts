const formatters = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(locale = 'en-CA', currency = 'CAD', options: Intl.NumberFormatOptions = {}) {
  const key = `${locale}-${currency}-${JSON.stringify(options)}`
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options
    }))
  }
  return formatters.get(key)!
}

export function getCompactFormatter(locale = 'en-CA', options: Intl.NumberFormatOptions = {}) {
  const key = `${locale}-compact-${JSON.stringify(options)}`
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, {
      notation: 'compact',
      ...options
    }))
  }
  return formatters.get(key)!
}
