cat << 'INNER_EOF' > /tmp/formatters_patch.txt
<<<<<<< SEARCH
export function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const cacheKey = getCacheKey(locale, 'number', options);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.NumberFormat(locale, options));
  }

  return formatterCache.get(cacheKey)!;
}
=======
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
>>>>>>> REPLACE
INNER_EOF
