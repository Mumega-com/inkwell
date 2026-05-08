## 2026-05-08 - Caching Intl.NumberFormat for React render performance
**Learning:** Instantiating new Intl.* formatters (like Intl.NumberFormat) inside React components is an expensive operation that causes CPU overhead and triggers unnecessary garbage collection cycles during frequent re-renders.
**Action:** Always create these formatters outside of the React component's render loop. For static locales/currencies, export them as constants from a shared utility file. For dynamic formats, cache the instances in a Map.
