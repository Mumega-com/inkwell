/**
 * Cached formatters for performance optimization.
 * Creating Intl.* instances is expensive and causes unnecessary garbage collection.
 * We cache commonly used formatters to reduce CPU overhead during renders.
 */

// Static formatters
export const cadCurrencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

export const cadCurrencyFormatterWithCents = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
});

export const usdCurrencyFormatterWithCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export const cadCompactFormatter = new Intl.NumberFormat('en-CA', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const cadCompactFormatterNoFraction = new Intl.NumberFormat('en-CA', {
  notation: 'compact',
});

// Dynamic formatters cache
const currencyFormattersCache = new Map<string, Intl.NumberFormat>();

export function getCurrencyFormatter(locale: string, currency: string, minimumFractionDigits = 2): Intl.NumberFormat {
  const cacheKey = `${locale}-${currency}-${minimumFractionDigits}`;
  if (!currencyFormattersCache.has(cacheKey)) {
    currencyFormattersCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits,
      })
    );
  }
  return currencyFormattersCache.get(cacheKey)!;
}
