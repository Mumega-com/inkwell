## 2024-12-05 - Intl.NumberFormat Instantiation Overhead
**Learning:** Instantiating `Intl.NumberFormat` inside React render cycles or formatting loops causes noticeable CPU overhead and memory pressure, as V8 performs significant setup for each instance. This is a common performance pitfall in data-heavy views like tables and dashboards.
**Action:** Always cache `Intl.NumberFormat` (and `Intl.DateTimeFormat`) instances at the module level. For dynamic configuration (like variable currency codes), use a `Map` to cache instances by configuration key.
