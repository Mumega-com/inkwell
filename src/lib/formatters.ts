// Memory optimization: cache Intl.NumberFormat instances to prevent expensive recreation on every render
// Uses a stable cache key via sorted JSON.stringify to handle variable formatting options reliably

const formattersCache = new Map<string, Intl.NumberFormat>();

function getFormatterKey(locales: string | string[] | undefined, options: Intl.NumberFormatOptions = {}): string {
  // stable serialization of the options object
  const sortedOptionsStr = JSON.stringify(options, Object.keys(options).sort());
  const localesStr = Array.isArray(locales) ? locales.join(',') : (locales || 'en-US');
  return `${localesStr}-${sortedOptionsStr}`;
}

export function getNumberFormatter(options: Intl.NumberFormatOptions & { locales?: string | string[] } = {}): Intl.NumberFormat {
  const { locales, ...fmtOptions } = options;
  const resolvedLocales = locales || 'en-US';
  const key = getFormatterKey(resolvedLocales, fmtOptions);

  if (!formattersCache.has(key)) {
    formattersCache.set(key, new Intl.NumberFormat(resolvedLocales, fmtOptions));
  }

  return formattersCache.get(key)!;
}

export function getCurrencyFormatter(options: Intl.NumberFormatOptions & { locales?: string | string[] } = {}): Intl.NumberFormat {
  const { locales, ...fmtOptions } = options;
  const resolvedLocales = locales || 'en-CA';

  // Do NOT set maximumFractionDigits: 0 by default here, as it throws RangeError when callers
  // provide minimumFractionDigits > 0. Let the caller specify maximumFractionDigits if they want it.
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'CAD',
    ...fmtOptions
  };

  const key = getFormatterKey(resolvedLocales, mergedOptions);

  if (!formattersCache.has(key)) {
    formattersCache.set(key, new Intl.NumberFormat(resolvedLocales, mergedOptions));
  }

  return formattersCache.get(key)!;
}
