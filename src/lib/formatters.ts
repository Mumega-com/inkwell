const formatterCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function getCacheKey(locale: string | undefined, type: 'number' | 'currency' | 'datetime', options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions): string {
  const safeLocale = locale ?? 'default';
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${safeLocale}:${type}:${optionsKey}`;
}

export function getNumberFormatter(locale?: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getCacheKey(locale, 'number', options);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }

  return formatterCache.get(cacheKey) as Intl.NumberFormat;
}

export function getCurrencyFormatter(locale: string | undefined, currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };

  const cacheKey = getCacheKey(locale, 'currency', formatterOptions);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, formatterOptions));
  }

  return formatterCache.get(cacheKey) as Intl.NumberFormat;
}

export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getCacheKey(locale, 'datetime', options);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return formatterCache.get(cacheKey) as Intl.DateTimeFormat;
}
