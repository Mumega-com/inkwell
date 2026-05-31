## 2024-05-29 - Caching Intl Formatters
**Learning:** Instantiating `Intl.NumberFormat` and `Intl.DateTimeFormat` inside React render cycles or formatting functions causes unnecessary CPU overhead and garbage collection, especially when rendering lists or tables.
**Action:** Always cache `Intl.NumberFormat`, `Intl.DateTimeFormat`, and other expensive formatting instances at the module level (using constants or a Map for dynamic locales/currencies) to avoid performance hits during frequent renders.
