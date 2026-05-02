## 2026-05-02 - Intl.NumberFormat Caching
**Learning:** Instantiating `Intl.NumberFormat` repeatedly inside the `render` function (e.g. per table cell in `DataTable` or per render in `KPICard`) causes high CPU overhead, making tables slow to render and updates sluggish. Caching these formatters at the module-level provides over 10-20x speedup in formatting calls.
**Action:** Always check React components that display numbers, currencies, or dates in tables or loops to ensure formatting objects (like `Intl.NumberFormat` or `Intl.DateTimeFormat`) are extracted as module-level constants.
