## 2025-05-18 - Intl Object Optimization
**Learning:** Initializing `Intl.NumberFormat` and `Intl.DateTimeFormat` inside loop or render functions is a known anti-pattern in React and JavaScript in general due to their high initialization cost, causing high CPU overhead and garbage collection pauses.
**Action:** Extract formatters to module scope or use useMemo/memoization. Caching formatters at the module level is especially efficient since we often format multiple numbers or currencies in the same component.
