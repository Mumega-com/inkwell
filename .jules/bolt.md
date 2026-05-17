## 2023-10-27 - [Formatters Cache]
**Learning:** `Intl.NumberFormat` instantiation is notoriously slow in JavaScript. In components like `DataTable` that map over many rows and cells, repeatedly creating these formatters inside the render loop acts as a significant performance bottleneck.
**Action:** Extract formatters to module-level constants to ensure they are cached and reused across all renders.
