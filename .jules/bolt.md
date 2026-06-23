## 2024-06-23 - Cache Intl.NumberFormat across the application
**Learning:** Instantiating new `Intl.NumberFormat` instances during React renders causes unnecessary CPU overhead and garbage collection, making the application slower.
**Action:** Always cache and reuse `Intl.NumberFormat` and `Intl.DateTimeFormat` instances (e.g., using a module-level Map with stable keys) rather than re-creating them dynamically inside components.
