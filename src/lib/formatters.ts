/**
 * Centralized formatting utility to cache Intl.NumberFormat instances.
 * Instantiating Intl.NumberFormat is CPU-intensive, so we memoize them to
 * avoid unnecessary CPU overhead and garbage collection during renders.
 */

const formatters = new Map<string, Intl.NumberFormat>();

export function getCurrencyFormatter(currency: string = 'CAD', locale: string = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `currency-${locale}-${currency}-${options?.minimumFractionDigits ?? ''}-${options?.maximumFractionDigits ?? ''}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }));
  }
  return formatters.get(key)!;
}

export function getCompactFormatter(locale: string = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `compact-${locale}-${options?.minimumFractionDigits ?? ''}-${options?.maximumFractionDigits ?? ''}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, { notation: 'compact', ...options }));
  }
  return formatters.get(key)!;
}

export function getNumberFormatter(locale: string = 'en-CA', options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `number-${locale}-${options?.minimumFractionDigits ?? ''}-${options?.maximumFractionDigits ?? ''}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, options));
  }
  return formatters.get(key)!;
}
