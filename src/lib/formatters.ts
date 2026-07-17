const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string, type: 'number' | 'currency', options: Intl.NumberFormatOptions): string {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${locale}:${type}:${optionsKey}`;
}

// Ensure getNumberFormatter accepts optional locale for system default fallback
export function getNumberFormatter(locale?: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const resolvedLocale = locale || 'default';
  // Use resolvedLocale for caching, pass undefined to Intl.NumberFormat for system default
  const cacheKey = getCacheKey(resolvedLocale, 'number', options);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }

  return formatterCache.get(cacheKey)!;
}

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeCacheKey(locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const resolvedLocale = locale || 'default';
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${resolvedLocale}:${optionsKey}`;
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
