const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, type: 'number' | 'currency', options: Intl.NumberFormatOptions): string {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${locale}:${type}:${optionsKey}`;
}

export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getCacheKey(locale, 'number', options);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }

  return formatterCache.get(cacheKey)!;
}

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeCacheKey(locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const safeLocale = locale ?? 'default';
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${safeLocale}:datetime:${optionsKey}`;
}

export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getDateTimeCacheKey(locale, options);

  if (!dateTimeFormatterCache.has(cacheKey)) {
    dateTimeFormatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return dateTimeFormatterCache.get(cacheKey)!;
}

export function getCurrencyFormatter(locale: string, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };

  const cacheKey = getCacheKey(locale, 'currency', formatterOptions);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, formatterOptions));
  }

  return formatterCache.get(cacheKey)!;
}
