
## 2024-06-28 - [Instantiating Intl.NumberFormat in React Renders]
**Learning:** Instantiating `Intl.NumberFormat` on every render or within large loops in React components introduces unnecessary CPU overhead and garbage collection pauses. This is particularly noticeable in high-frequency rendering components like data tables and dashboards.
**Action:** Centralized the formatter creation in `src/lib/formatters.ts` by using a module-level `Map` cache keyed by locale and stringified options. Use `getNumberFormatter` and `getCurrencyFormatter` exports across all components going forward to ensure stable object references and eliminate redundant instantiations.
