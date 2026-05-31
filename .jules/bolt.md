## 2024-05-21 - [Cache Intl.NumberFormat]
**Learning:** Instantiating `Intl.NumberFormat` is an expensive operation in JavaScript, and doing it repeatedly inside render loops or frequently called utility functions causes unnecessary CPU overhead and garbage collection.
**Action:** Always cache `Intl.NumberFormat` and `Intl.DateTimeFormat` instances at the module level (e.g., in a dedicated formatters file) and reuse them across the application.
