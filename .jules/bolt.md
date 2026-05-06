## 2024-05-06 - Initial

## 2024-05-06 - Caching Intl Formatters
**Learning:** Instantiating `Intl.NumberFormat` (or `Intl.DateTimeFormat`) is surprisingly expensive and creates unnecessary CPU overhead and garbage collection, especially when done inside React component renders or mapping functions.
**Action:** Always cache `Intl.*Format` instances at the module level (e.g. using constants or a Map for dynamic locales/currencies) rather than recreating them on every render or function call.
