## 2024-05-24 - Cached Intl.NumberFormat
**Learning:** Instantiating `Intl.NumberFormat` is expensive. Calling it inside render cycles or table cell formatters introduces unnecessary CPU and Garbage Collection overhead.
**Action:** Cache `Intl.NumberFormat` instances at the module level whenever possible, especially in list and table rendering components.
