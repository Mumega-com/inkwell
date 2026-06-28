export const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, options?: Intl.NumberFormatOptions): string {
  if (!options) return locale;
  return `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`;
}

/**
 * Returns a cached Intl.NumberFormat instance to avoid CPU overhead of instantiating
 * new formatters on every render or in loops.
 */
export function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = getCacheKey(locale, options);
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, options));
  }
  return formatterCache.get(key)!;
}

export function getCurrencyFormatter(locale: string, currency: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const currencyOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };
  return getNumberFormatter(locale, currencyOptions);
}
