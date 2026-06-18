// Cached Intl.NumberFormat to avoid CPU overhead during React renders
const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, options?: Intl.NumberFormatOptions): string {
  return `${locale}-${JSON.stringify(options || {})}`;
}

export function getCurrencyFormatter(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = 'en-CA';
  const baseOptions: Intl.NumberFormatOptions = { style: 'currency', currency: 'CAD' };
  const mergedOptions = { ...baseOptions, ...options };
  const key = getCacheKey(locale, mergedOptions);

  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, mergedOptions));
  }
  return formatterCache.get(key)!;
}

export function getCompactFormatter(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = 'en-CA';
  const baseOptions: Intl.NumberFormatOptions = { notation: 'compact' };
  const mergedOptions = { ...baseOptions, ...options };
  const key = getCacheKey(locale, mergedOptions);

  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, mergedOptions));
  }
  return formatterCache.get(key)!;
}
