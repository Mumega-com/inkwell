const numberFormatterCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`;
  if (!numberFormatterCache.has(key)) {
    numberFormatterCache.set(key, new Intl.NumberFormat(locale, options));
  }
  return numberFormatterCache.get(key)!;
}

export function getCurrencyFormatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return getNumberFormatter(locale, { style: 'currency', currency, ...options });
}
