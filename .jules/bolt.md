## 2024-06-13 - [Performance] Cache Intl.NumberFormat instances to prevent CPU overhead
**Learning:** Instantiating `new Intl.NumberFormat` inside React components is expensive and leads to unnecessary CPU overhead and garbage collection during re-renders, especially in fast-changing elements like KPI cards and data tables.
**Action:** Always cache `Intl.NumberFormat` instances at the module level (e.g. using a Map in `src/lib/formatters.ts`) and export helper functions to format currencies and compact numbers instead of creating new instances dynamically inside renders.
