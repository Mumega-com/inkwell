## 2024-05-18 - [React Re-render CPU Profiling: Intl.NumberFormat Instantiation]
**Learning:** Instantiating `Intl.NumberFormat` instances directly inside React functional components is a hidden CPU bottleneck, causing significant overhead during re-renders, especially when rendering lists or data tables with multiple formatted columns.
**Action:** Always create a centralized caching utility (e.g., using a Map) for `Intl.NumberFormat` instances across the codebase to cache them by locale and options, avoiding repetitive instantiations inside render functions.
