const numberFormatterCache = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`
  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, options))
  }
  return numberFormatterCache.get(cacheKey)!
}
