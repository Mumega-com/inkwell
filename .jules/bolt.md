## 2024-06-05 - [Cache Intl.NumberFormat for React Renders]
 **Learning:** Repeatedly instantiating `Intl.NumberFormat` inside React components (especially in lists or frequently updated dashboards) causes unnecessary CPU overhead and garbage collection.
 **Action:** Always create a centralized caching utility (like a Map) for `Intl.NumberFormat` instances to reuse them across components instead of `new Intl.NumberFormat(...)` on every render.
