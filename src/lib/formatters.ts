/**
 * Cache Intl.NumberFormat instances to avoid performance overhead
 * of creating new instances repeatedly, particularly during renders.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function getFormatterKey(locale: string, options: Intl.NumberFormatOptions = {}): string {
  // Sort keys to ensure consistent cache keys regardless of object creation order
  const sortedOptions = Object.keys(options)
    .sort()
    .reduce((acc, key) => {
      acc[key as keyof Intl.NumberFormatOptions] = options[key as keyof Intl.NumberFormatOptions];
      return acc;
    }, {} as Intl.NumberFormatOptions);

  return `${locale}-${JSON.stringify(sortedOptions)}`;
}

export function getFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = getFormatterKey(locale, options);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

export function getCurrencyFormatter(
  locale: string = 'en-CA',
  currency: string = 'CAD',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  return getFormatter(locale, { style: 'currency', currency, ...options });
}

export function getCompactFormatter(
  locale: string = 'en-CA',
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  return getFormatter(locale, { notation: 'compact', ...options });
}
