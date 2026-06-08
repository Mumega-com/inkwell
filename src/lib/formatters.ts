// ⚡ Bolt: Cache Intl.NumberFormat instances to prevent expensive re-instantiations
// on every render. Dynamic instantiation of Intl.NumberFormat is surprisingly slow
// and can cause performance bottlenecks in list/table components.

const CACHE = new Map<string, Intl.NumberFormat>();

function getFormatterKey(locale: string, options?: Intl.NumberFormatOptions): string {
  if (!options) return locale;
  // A simple deterministic serialization for typical options
  return `${locale}|${JSON.stringify(options, Object.keys(options).sort())}`;
}

/**
 * Returns a cached Intl.NumberFormat instance.
 */
export function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = getFormatterKey(locale, options);
  if (CACHE.has(key)) {
    return CACHE.get(key)!;
  }
  const formatter = new Intl.NumberFormat(locale, options);
  CACHE.set(key, formatter);
  return formatter;
}

/**
 * Convenience method for getting a currency formatter.
 */
export function getCurrencyFormatter(
  currency: string = 'CAD',
  locale: string = 'en-CA',
  minimumFractionDigits?: number,
  maximumFractionDigits?: number
): Intl.NumberFormat {
  const options: Intl.NumberFormatOptions = { style: 'currency', currency };
  if (minimumFractionDigits !== undefined) {
    options.minimumFractionDigits = minimumFractionDigits;
  }
  if (maximumFractionDigits !== undefined) {
    options.maximumFractionDigits = maximumFractionDigits;
  }
  return getNumberFormatter(locale, options);
}

/**
 * Convenience method for getting a compact formatter (e.g. 1.2K).
 */
export function getCompactFormatter(
  locale: string = 'en-CA',
  maximumFractionDigits: number = 1
): Intl.NumberFormat {
  return getNumberFormatter(locale, { notation: 'compact', maximumFractionDigits });
}
