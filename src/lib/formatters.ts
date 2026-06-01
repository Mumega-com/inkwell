/**
 * Centralized formatting utility to cache Intl instances and prevent CPU overhead
 * during React renders.
 */
const numberFormattersCache = new Map<string, Intl.NumberFormat>();

export function getCurrencyFormatter(
  currency = 'CAD',
  locale = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const cacheKey = `currency-${locale}-${currency}-${JSON.stringify(options)}`;
  if (!numberFormattersCache.has(cacheKey)) {
    numberFormattersCache.set(cacheKey, new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options
    }));
  }
  return numberFormattersCache.get(cacheKey)!;
}

export function getCompactFormatter(
  locale = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const cacheKey = `compact-${locale}-${JSON.stringify(options)}`;
  if (!numberFormattersCache.has(cacheKey)) {
    numberFormattersCache.set(cacheKey, new Intl.NumberFormat(locale, {
      notation: 'compact',
      ...options
    }));
  }
  return numberFormattersCache.get(cacheKey)!;
}

export function getNumberFormatter(
  locale = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const cacheKey = `number-${locale}-${JSON.stringify(options)}`;
  if (!numberFormattersCache.has(cacheKey)) {
    numberFormattersCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }
  return numberFormattersCache.get(cacheKey)!;
}
