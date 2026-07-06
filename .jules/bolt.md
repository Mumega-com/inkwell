## 2025-07-06 - Cache Intl.NumberFormat Instantiations
**Learning:** Instantiating `Intl.NumberFormat` frequently within React component renders (e.g., in loops or simple helper functions) can cause noticeable CPU overhead, especially with many items. Caching instances prevents this overhead since the format objects are reusable.
**Action:** Created `src/lib/formatters.ts` to implement a centralized, memoized format cache for `Intl.NumberFormat`. Will now update `KPICard.tsx`, `DataTable.tsx`, `ArrowDashboard.tsx`, and other components to use it.
