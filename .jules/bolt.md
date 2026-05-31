## 2025-05-27 - Cache Intl.NumberFormat instances
**Learning:** Instantiating new `Intl.NumberFormat` objects inside React render cycles (or inside loops) is a significant CPU bottleneck in this application, taking roughly 550ms for 10,000 items compared to 10ms when cached.
**Action:** Always cache `Intl.NumberFormat` (and `Intl.DateTimeFormat`) instances using Maps or constants, especially when formatting data in tables or charts where formatting functions are called frequently.
