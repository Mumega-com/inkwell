// ⚡ Bolt: Centralized formatters to cache Intl instances and prevent unnecessary CPU overhead
// and garbage collection during React component renders.

const formatterCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = options
    ? `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`
    : locale;

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }
  return formatterCache.get(cacheKey)!;
}

export function getCurrencyFormatter(locale: string, currency: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  // Avoid restrictive defaults that can throw RangeError when merging with caller overrides
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };
  return getNumberFormatter(locale, mergedOptions);
}
