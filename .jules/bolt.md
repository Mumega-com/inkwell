## 2024-05-19 - Cache Intl formatting objects
**Learning:** Instantiating `Intl.NumberFormat` (or `Intl.DateTimeFormat`) inside React component render loops or formatting functions called multiple times (like in `DataTable.tsx` mapping over rows) is a significant performance bottleneck due to expensive initialization and garbage collection overhead.
**Action:** Always cache `Intl.*` formatters at the module level (or using `useMemo` if locale/currency changes dynamically) instead of creating new instances inside loops or formatting utility functions.
