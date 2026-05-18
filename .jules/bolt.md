## 2024-05-14 - Inline Intl Formatters CPU Overhead
**Learning:** Frequent, inline instantiations of `Intl.NumberFormat` and `Intl.DateTimeFormat` within render functions or commonly used helper functions cause significant CPU overhead and garbage collection pressure, particularly in list/table rendering like invoices and dashboards.
**Action:** Extract these instances to module-level constants or use a `Map` to cache instances for dynamic variables (like varying currencies).
