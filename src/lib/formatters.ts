const formatterCache = new Map<string, Intl.NumberFormat>();

function getCacheKey(locale: string = 'default', type: 'number' | 'currency', options: Intl.NumberFormatOptions): string {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${locale}:${type}:${optionsKey}`;
}

export function getNumberFormatter(locale: string = 'default', options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getCacheKey(locale, 'number', options);

  if (!formatterCache.has(cacheKey)) {
    const localeArg = locale === 'default' ? undefined : locale;
    formatterCache.set(cacheKey, new Intl.NumberFormat(localeArg, options));
  }

  return formatterCache.get(cacheKey)!;
}

export function getCurrencyFormatter(locale: string = 'default', currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    ...options
  };

  const cacheKey = getCacheKey(locale, 'currency', formatterOptions);

  if (!formatterCache.has(cacheKey)) {
    const localeArg = locale === 'default' ? undefined : locale;
    formatterCache.set(cacheKey, new Intl.NumberFormat(localeArg, formatterOptions));
  }

  return formatterCache.get(cacheKey)!;
}

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeCacheKey(locale: string = 'default', options: Intl.DateTimeFormatOptions): string {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  return `${locale}:${optionsKey}`;
}

export function getDateTimeFormatter(locale: string = 'default', options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getDateTimeCacheKey(locale, options);

  if (!dateTimeFormatterCache.has(cacheKey)) {
    const localeArg = locale === 'default' ? undefined : locale;
    dateTimeFormatterCache.set(cacheKey, new Intl.DateTimeFormat(localeArg, options));
  }

  return dateTimeFormatterCache.get(cacheKey)!;
}
