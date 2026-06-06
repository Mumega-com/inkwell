## 2024-06-06 - Formatters Module
**Learning:** `Intl.NumberFormat` instantiation inside React component loops creates performance bottlenecks (CPU overhead).
**Action:** Create a centralized cache module for formatters and refactor components to use it.
