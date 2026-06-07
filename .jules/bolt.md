## 2025-06-07 - Cache Intl.NumberFormat
**Learning:** Instantiating `Intl.NumberFormat` repeatedly inside React render loops or frequently called helper functions causes measurable CPU overhead and unnecessary garbage collection.
**Action:** When working with formatting APIs in frontend components, always cache instances (e.g., in a Map using a module-level variable) to share across the application rather than creating them inline.
