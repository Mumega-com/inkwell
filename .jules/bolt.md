## 2023-10-27 - [NumberFormatter Cache]
**Learning:** Instantiating `Intl.NumberFormat` frequently within React component renders (e.g., in tables or list item loops) causes significant, unnecessary CPU overhead and garbage collection, degrading frontend performance.
**Action:** Always cache `Intl.NumberFormat` (and `Intl.DateTimeFormat`) instances at the module level. I implemented a centralized caching utility using `Map` with deterministic serialization of the options object (`JSON.stringify` with sorted keys) to guarantee safe re-use of identical formatters across components.
