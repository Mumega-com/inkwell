## 2024-05-24 - Avoid Creating Intl.NumberFormat in React Renders
**Learning:** Instantiating `Intl.NumberFormat` (and `Intl.DateTimeFormat`) is relatively expensive and CPU-intensive. When done inside React components or utility functions called during renders (like formatting cells in a table or KPI cards), it can cause significant garbage collection overhead and slower renders.
**Action:** Always cache `Intl.NumberFormat` and similar formatting instances at the module level (using constants or Maps for dynamic locales/currencies) to reuse them across renders.
