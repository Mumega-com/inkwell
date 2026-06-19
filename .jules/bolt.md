
## 2026-06-19 - Cache Intl objects for UI rendering
**Learning:** Inline instantiation of `Intl.NumberFormat` inside React render cycles (e.g., table cells, KPI cards) causes unnecessary CPU overhead and garbage collection, severely degrading performance in list views.
**Action:** Always cache `Intl.NumberFormat`, `Intl.DateTimeFormat`, and other expensive formatting instances at the module level (using constants or a Map for dynamic locales/currencies) and export them as utility functions.
