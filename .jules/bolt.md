
## 2024-11-20 - Formatter Caching
**Learning:** Instantiating `Intl.NumberFormat` on every render causes unnecessary CPU overhead and garbage collection.
**Action:** Use centralized cached formatters (`getNumberFormatter` / `getCurrencyFormatter`) stored in a Map, utilizing a stable serialized cache key (sorted JSON.stringify) to ensure consistency. Do not apply restrictive default options that throw RangeErrors when overridden.
