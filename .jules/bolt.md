## 2024-05-24 - Expensive Intl Formatting
**Learning:** Instantiating `Intl.NumberFormat` repeatedly inside a frequently called function (like one used during a render loop or when formatting tabular data) creates a lot of unnecessary CPU load and garbage collection.
**Action:** Always cache instances of `Intl.NumberFormat` at the module level whenever possible, particularly in UI components rendering charts, lists, or tables.
