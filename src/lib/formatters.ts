type NumberFormatOptions = Intl.NumberFormatOptions & { locale?: string };

const formattersCache = new Map<string, Intl.NumberFormat>();

function getFormatterKey(options: NumberFormatOptions): string {
  // Sort keys to ensure consistent caching
  const sortedKeys = Object.keys(options).sort();
  const sortedOptions: any = {};
  for (const key of sortedKeys) {
    sortedOptions[key] = (options as any)[key];
  }
  return JSON.stringify(sortedOptions);
}

export function getFormatter(options: NumberFormatOptions): Intl.NumberFormat {
  const key = getFormatterKey(options);
  if (formattersCache.has(key)) {
    return formattersCache.get(key)!;
  }
  const { locale = 'en-CA', ...intlOptions } = options;
  const formatter = new Intl.NumberFormat(locale, intlOptions);
  formattersCache.set(key, formatter);
  return formatter;
}
