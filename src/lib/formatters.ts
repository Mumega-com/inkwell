const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getCacheKey(locale: string | undefined, type: 'number' | 'currency' | 'datetime', options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions): string {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(options, Object.keys(options).sort())
    : '{}';
  const safeLocale = locale ?? 'default';
  return `${safeLocale}:${type}:${optionsKey}`;
}

// ⚡ Bolt: Cache Intl objects to prevent expensive instantiations during React render cycles.
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

// ⚡ Bolt: Cache Intl objects to prevent expensive instantiations during React render cycles.
export function getDateTimeFormatter(locale?: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const cacheKey = getCacheKey(locale, 'datetime', options);

  if (!dateTimeFormatterCache.has(cacheKey)) {
    dateTimeFormatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return dateTimeFormatterCache.get(cacheKey)!;
}
