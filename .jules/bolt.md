## 2024-05-20 - [Performance] Cache Intl Formatters
**Learning:** `Intl.NumberFormat` instantiation inside functional components (especially ones repeatedly rendered or rendering lists/tables) causes notable CPU overhead.
**Action:** Extract standard formatters (like CAD or USD currencies) to module-level constants. For dynamic parameters like `currency` from props/data, use a module-level `Map` to cache and reuse the formatters.
