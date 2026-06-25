// Cache for number formatters to avoid recreating them on every render
const numberFormatters = new Map<string, Intl.NumberFormat>()

/**
 * Gets a cached instance of Intl.NumberFormat
 *
 * @param locale The locale string
 * @param options The formatting options
 * @returns A cached Intl.NumberFormat instance
 */
export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  // Use a stable JSON serialization for the key by sorting the keys of the options object
  const key = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`

  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat(locale, options))
  }

  return numberFormatters.get(key)!
}

/**
 * Gets a cached instance of Intl.NumberFormat for currency
 *
 * @param locale The locale string
 * @param currency The currency code
 * @param options Additional formatting options
 * @returns A cached Intl.NumberFormat instance
 */
export function getCurrencyFormatter(locale: string, currency: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return getNumberFormatter(locale, { style: 'currency', currency, ...options })
}
