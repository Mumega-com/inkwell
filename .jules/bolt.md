## 2025-06-30 - [Performance] Cache Intl.NumberFormat instances
**Learning:** `Intl.NumberFormat` instantiation is a significant source of CPU overhead during React component renders, especially when rendering lists or data tables with multiple formatted numbers.
**Action:** Always use the centralized formatters module (`src/lib/formatters.ts`) to cache `Intl.NumberFormat` instances and generate stable keys using sorted option properties.
