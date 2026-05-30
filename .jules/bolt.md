## 2024-05-30 - Cache Intl.NumberFormat Instantiations
**Learning:** React components frequently creating new `Intl.NumberFormat` instances during renders (especially within large lists like tables or grids) causes significant CPU overhead and can block the main thread, resulting in jank.
**Action:** Always create a module-level cache (e.g., using a Map to key by locale and options) or use constant formatters rather than instantiating `Intl.NumberFormat` inside render functions or simple getter functions.
