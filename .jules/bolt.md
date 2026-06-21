## 2024-06-21 - Cache Intl.NumberFormat
**Learning:** Instantiating `Intl.NumberFormat` repeatedly in React component loops and renders causes significant CPU overhead and garbage collection pauses in this React-Astro architecture.
**Action:** Use the centralized `src/lib/formatters.ts` utility that caches these formatter instances to prevent unnecessary allocations.
