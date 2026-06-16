
## 2025-06-16 - Cache Intl.NumberFormat instances to prevent overhead
**Learning:** Re-instantiating `Intl.NumberFormat` in React component renders causes significant CPU overhead and garbage collection, particularly when rendering large lists or complex dashboards.
**Action:** Cache these formatter instances at the module level (e.g. using a Map in a centralized `formatters.ts` file) and reuse them to eliminate unnecessary object creation during UI updates.
