const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, options: Intl.NumberFormatOptions): string {
  const sortedOptions = Object.keys(options)
    .sort()
    .reduce((acc, key) => {
      acc[key as keyof Intl.NumberFormatOptions] = options[key as keyof Intl.NumberFormatOptions] as any;
      return acc;
    }, {} as Intl.NumberFormatOptions);
  return `${locale}-${JSON.stringify(sortedOptions)}`;
}

export function getNumberFormatter(options: Intl.NumberFormatOptions, locale = 'en-CA'): Intl.NumberFormat {
  const key = getCacheKey(locale, options);
  if (!numberFormatterCache.has(key)) {
    numberFormatterCache.set(key, new Intl.NumberFormat(locale, options));
  }
  return numberFormatterCache.get(key)!;
}

export function getCurrencyFormatter(options: Intl.NumberFormatOptions = {}, locale = 'en-CA'): Intl.NumberFormat {
  // Ensure we don't accidentally set maximumFractionDigits: 0 if not explicitly requested,
  // as it could conflict with caller overrides. Let the caller specify if needed.
  return getNumberFormatter({ style: 'currency', currency: 'CAD', ...options }, locale);
}
