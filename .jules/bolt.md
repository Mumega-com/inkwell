## 2024-05-18 - Caching Intl Formatter in React Components
**Learning:** `Intl.NumberFormat` instantiation is notoriously expensive. Instantiating it per cell within an O(n) table render loop or a component like KPICard can cause noticeable UI delays and heavy garbage collection during renders.
**Action:** Always cache stateless `Intl` formatter instances at the module scope so they are created exactly once.
