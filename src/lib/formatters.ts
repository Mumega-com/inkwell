// src/lib/formatters.ts

/**
 * Cache Intl.NumberFormat instances to prevent CPU overhead and garbage collection
 * during React renders, as instantiation is relatively expensive.
 */
const formatters = new Map<string, Intl.NumberFormat>();

export function getCurrencyFormatter(locale = 'en-CA', currency = 'CAD', options: Intl.NumberFormatOptions = {}) {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(Object.entries(options).sort())
    : '';
  const key = `currency-${locale}-${currency}-${optionsKey}`;

  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }));
  }
  return formatters.get(key)!;
}

export function getCompactFormatter(locale = 'en-CA', options: Intl.NumberFormatOptions = {}) {
  const optionsKey = Object.keys(options).length > 0
    ? JSON.stringify(Object.entries(options).sort())
    : '';
  const key = `compact-${locale}-${optionsKey}`;

  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, { notation: 'compact', ...options }));
  }
  return formatters.get(key)!;
}
