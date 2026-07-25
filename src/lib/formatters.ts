// ⚡ Bolt Optimization:
// Repeated instantiation of `Intl.NumberFormat` and `Intl.DateTimeFormat` within
// React render loops is a significant CPU bottleneck. By caching and reusing
// these instances globally, we reduce GC pressure and speed up rendering.
const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getCacheKey(locale: string | undefined, type: string, options: any): string {
  const loc = locale || 'default';
  const optionsKey = options && Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${loc}:${type}:${optionsKey}`;
}

export function getNumberFormatter(locale?: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getCacheKey(locale, 'number', options);

  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }

  return numberFormatterCache.get(cacheKey)!;
}

export function getCurrencyFormatter(locale: string | undefined, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };

  const cacheKey = getCacheKey(locale, 'currency', formatterOptions);

  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, formatterOptions));
  }

  return numberFormatterCache.get(cacheKey)!;
}

export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getCacheKey(locale, 'datetime', options);

  if (!dateTimeFormatterCache.has(cacheKey)) {
    dateTimeFormatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return dateTimeFormatterCache.get(cacheKey)!;
}
