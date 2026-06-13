// ⚡ Bolt: Cache Intl.NumberFormat instances to prevent CPU overhead and excessive garbage collection during React re-renders.
const formatterCache = new Map<string, Intl.NumberFormat>();

interface CurrencyOptions {
  currency?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  locale?: string;
}

export const getCurrencyFormatter = (options: CurrencyOptions = {}) => {
  const currency = options.currency || 'CAD';
  const locale = options.locale || 'en-CA';
  const min = options.minimumFractionDigits;
  const max = options.maximumFractionDigits;

  const key = `${locale}-${currency}-${min}-${max}`;
  if (!formatterCache.has(key)) {
    const formatOptions: Intl.NumberFormatOptions = { style: 'currency', currency };
    if (min !== undefined) formatOptions.minimumFractionDigits = min;
    if (max !== undefined) formatOptions.maximumFractionDigits = max;
    formatterCache.set(key, new Intl.NumberFormat(locale, formatOptions));
  }
  return formatterCache.get(key)!;
};

interface CompactOptions {
  maximumFractionDigits?: number;
  locale?: string;
}

export const getCompactFormatter = (options: CompactOptions = {}) => {
  const locale = options.locale || 'en-CA';
  const max = options.maximumFractionDigits;

  const key = `compact-${locale}-${max}`;
  if (!formatterCache.has(key)) {
    const formatOptions: Intl.NumberFormatOptions = { notation: 'compact' };
    if (max !== undefined) formatOptions.maximumFractionDigits = max;
    formatterCache.set(key, new Intl.NumberFormat(locale, formatOptions));
  }
  return formatterCache.get(key)!;
};
