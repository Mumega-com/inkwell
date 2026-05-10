## 2024-05-24 - Expensive Intl Instantiation in Render Paths
**Learning:** Frequent instantiations of `Intl.NumberFormat` inside formatters that are called during component renders (`KPICard`, `DataTable`) can cause significant CPU overhead and garbage collection pressure in this codebase.
**Action:** Always extract `Intl.NumberFormat`, `Intl.DateTimeFormat`, etc., to the module scope (or use a caching mechanism) to avoid recreating them on every call, especially in frequently rendered charts/tables.
