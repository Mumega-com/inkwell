## 2026-05-16 - Cached Intl.NumberFormat
**Learning:** The project creates expensive `Intl.NumberFormat` instances on every render, especially in tables like `DataTable.tsx` where it runs per cell and per row, creating significant CPU overhead and GC pressure.
**Action:** Extract `Intl.NumberFormat` instances to module-level constants to reuse them across renders.
