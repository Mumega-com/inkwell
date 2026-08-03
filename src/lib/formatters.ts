const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getNumberCacheKey(locale: string | undefined, type: 'number' | 'currency', options: Intl.NumberFormatOptions): string {
  const loc = locale ?? 'default';
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${loc}:${type}:${optionsKey}`;
}

function getDateTimeCacheKey(locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const loc = locale ?? 'default';
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${loc}:${optionsKey}`;
}

export function getNumberFormatter(locale?: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getNumberCacheKey(locale, 'number', options);

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

  const cacheKey = getNumberCacheKey(locale, 'currency', formatterOptions);

  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, formatterOptions));
  }

  return numberFormatterCache.get(cacheKey)!;
}

export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getDateTimeCacheKey(locale, options);

  if (!dateTimeFormatterCache.has(cacheKey)) {
    dateTimeFormatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return dateTimeFormatterCache.get(cacheKey)!;
}
