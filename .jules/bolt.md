# Bolt's Journal
## 2024-06-03 - Caching Intl.NumberFormat
**Learning:** Intl.NumberFormat instantiation is expensive and can cause CPU bottlenecks when rendering many formatted cells (e.g., in a DataTable).
**Action:** Create a module-level Map to cache Intl.NumberFormat instances based on locale and options to prevent redundant instantiation during renders.
