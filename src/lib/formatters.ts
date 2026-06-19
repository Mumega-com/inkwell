// Cache Intl.NumberFormat instances to prevent unnecessary CPU overhead and garbage collection during renders
const numberFormatCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  // Sort keys to ensure stable cache key
  const cacheKey = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`;
  let formatter = numberFormatCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function getCurrencyFormatter(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return getNumberFormatter('en-CA', { style: 'currency', currency: 'CAD', ...options });
}

export function getCompactNumberFormatter(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return getNumberFormatter('en-CA', { notation: 'compact', ...options });
}
