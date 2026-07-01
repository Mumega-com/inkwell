## 2024-07-01 - Cache Intl.NumberFormat Instances
**Learning:** Instantiating `new Intl.NumberFormat()` within render loops or frequently called formatters is computationally expensive and causes unnecessary overhead.
**Action:** Always use a centralized caching utility (like `src/lib/formatters.ts`) to reuse `Intl.NumberFormat` instances across the application.
