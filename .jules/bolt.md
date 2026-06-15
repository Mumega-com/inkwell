## 2024-06-15 - Cached Number Formatter
**Learning:** Instantiating new Intl.NumberFormat in React render loops is expensive and causes performance overhead.
**Action:** Use a cached getFormatter function for all Intl.NumberFormat operations across the codebase.
