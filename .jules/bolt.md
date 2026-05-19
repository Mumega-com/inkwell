## 2024-05-18 - [Intl Formatter Caching]
**Learning:** `Intl.NumberFormat` and `Intl.DateTimeFormat` instantiations are expensive. When used inline within React component render paths (like iterating over rows in a DataTable), they repeatedly allocate and configure identical formatters, adding CPU overhead and garbage collection pressure that degrade list rendering performance.
**Action:** Cache these formatters at the module scope using constants instead of creating them inline in render or loop contexts.
