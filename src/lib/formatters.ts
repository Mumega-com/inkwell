// Centralized Intl.NumberFormat cache to prevent CPU overhead from repeated instantiations
const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, options?: Intl.NumberFormatOptions): string {
  if (!options) return locale;
  // Ensure stable cache key regardless of object key insertion order
  const sortedOptions = JSON.stringify(options, Object.keys(options).sort());
  return `${locale}|${sortedOptions}`;
}

export function getNumberFormatter(locale: string = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `number|${getCacheKey(locale, options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function getCurrencyFormatter(locale: string = 'en-CA', currency: string = 'CAD', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };
  const key = `currency|${getCacheKey(locale, mergedOptions)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, mergedOptions);
    formatterCache.set(key, formatter);
  }
  return formatter;
}
