// Cached NumberFormat instances for performance
const currencyFormatters = new Map<string, Intl.NumberFormat>()
const compactFormatters = new Map<string, Intl.NumberFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()

/**
 * Gets or creates a cached currency formatter
 */
export function getCurrencyFormatter(
  currency: string = 'CAD',
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}-${currency}-${JSON.stringify(options || {})}`

  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...options
      })
    )
  }

  return currencyFormatters.get(key)!
}

/**
 * Gets or creates a cached compact number formatter
 */
export function getCompactFormatter(
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options || {})}`

  if (!compactFormatters.has(key)) {
    compactFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        ...options
      })
    )
  }

  return compactFormatters.get(key)!
}

/**
 * Gets or creates a cached number formatter
 */
export function getNumberFormatter(
  locale: string = 'en-CA',
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options || {})}`

  if (!numberFormatters.has(key)) {
    numberFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        ...options
      })
    )
  }

  return numberFormatters.get(key)!
}
