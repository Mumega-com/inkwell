## 2024-07-08 - Caching Intl.NumberFormat Instances
**Learning:** Repeatedly instantiating `Intl.NumberFormat` inside React component render functions or formatters creates significant CPU overhead, especially when processing arrays of data like in DataTables or multiple KPI cards.
**Action:** Always use a centralized caching utility (like `src/lib/formatters.ts`) that memoizes `Intl.NumberFormat` instances based on a stable cache key derived from the locale and sorted options.
