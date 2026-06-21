const formatterCache = new Map<string, Intl.NumberFormat>();

export interface FormatterOptions extends Intl.NumberFormatOptions {
  locale?: string;
}

export function getNumberFormatter(options: FormatterOptions = {}): Intl.NumberFormat {
  const { locale = 'en-CA', ...restOptions } = options;
  const cacheKey = `${locale}-${JSON.stringify(restOptions, Object.keys(restOptions).sort())}`;

  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, restOptions);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function getCurrencyFormatter(options: FormatterOptions = {}): Intl.NumberFormat {
  const { locale = 'en-CA', currency = 'CAD', ...restOptions } = options;
  const mergedOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...restOptions
  };
  const cacheKey = `${locale}-${JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort())}`;

  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, mergedOptions);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}
