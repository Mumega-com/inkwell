export const getNumberFormatter = (() => {
  const cache = new Map<string, Intl.NumberFormat>();
  return (locale: string, options: Intl.NumberFormatOptions = {}) => {
    // Generate cache key
    const key = `${locale}-${JSON.stringify(options, Object.keys(options).sort())}`;
    if (!cache.has(key)) {
      cache.set(key, new Intl.NumberFormat(locale, options));
    }
    return cache.get(key)!;
  };
})();

export const getCurrencyFormatter = (locale: string, currency: string, options: Intl.NumberFormatOptions = {}) => {
  return getNumberFormatter(locale, { style: 'currency', currency, ...options });
};
