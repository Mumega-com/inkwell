## 2024-06-14 - Caching Intl Formats
**Learning:** `new Intl.NumberFormat()` allocations inside React component render cycles cause unnecessary CPU overhead and garbage collection, especially in loops like tables.
**Action:** Always use the centralized `src/lib/formatters.ts` utility functions (`getCurrencyFormatter`, `getNumberFormatter`) with an options object to cache and reuse these expensive instances.
