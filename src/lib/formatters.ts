const formatters = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(options?: Intl.NumberFormatOptions & { locales?: string | string[] }): Intl.NumberFormat {
  const locales = options?.locales || 'en-CA'
  const opts = { ...options }
  delete opts.locales
  const key = `${locales}-${JSON.stringify(opts)}`
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locales, opts))
  }
  return formatters.get(key)!
}
