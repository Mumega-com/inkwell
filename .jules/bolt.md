
## 2024-05-18 - Caching Intl.NumberFormat in React Components
**Learning:** `Intl.NumberFormat` instantiation is notoriously slow and CPU-intensive. When done inside components like a `DataTable` (which may render hundreds of cells) or `KPICard`s on every render, it can significantly block the main thread.
**Action:** Always cache `Intl.NumberFormat` instances using a stable key like `` `${locale}-${JSON.stringify(options, Object.keys(options).sort())}` `` to prevent unnecessary CPU overhead and garbage collection.
