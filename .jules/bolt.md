## 2024-05-18 - Cache Intl Formatters
**Learning:** Instantiating `Intl.NumberFormat` inside React render loops causes unnecessary CPU overhead and garbage collection.
**Action:** Use a centralized module with `Map` to cache and reuse formatter instances (`src/lib/formatters.ts`) across components.
