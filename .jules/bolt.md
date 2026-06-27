## 2024-06-27 - [CPU] Cache Intl.NumberFormat
**Learning:** Dynamically instantiating `Intl.NumberFormat` inside React render cycles (like in `formatValue` or `formatCell`) is an expensive operation that adds unnecessary CPU overhead and garbage collection, especially in loops like those used in `DataTable`.
**Action:** Cache these expensive formatting instances at the module level using a centralized formatter utility (`src/lib/formatters.ts`) to avoid recreating them on every render.
