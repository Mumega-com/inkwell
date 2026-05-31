## 2024-05-31 - Cache Intl.NumberFormat to prevent CPU overhead
 **Learning:** Instantiating `Intl.NumberFormat` instances dynamically on every React render inside formatting functions like `formatCurrency` introduces CPU overhead and garbage collection pressure, negatively impacting performance.
 **Action:** Always create a module-level cache for expensive Intl formatting instances (like `Intl.NumberFormat` or `Intl.DateTimeFormat`) instead of directly creating new instances inside render blocks or functional component scopes.
