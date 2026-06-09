## 2026-06-09 - [Performance] Cache Intl.NumberFormat objects
**Learning:** Instantiating new `Intl.NumberFormat` instances on every render is a common CPU overhead in React components. This codebase frequently renders formatted numbers in Dashboard and Data Tables, exacerbating the problem.
**Action:** Extract formatting objects (like `Intl.NumberFormat` or `Intl.DateTimeFormat`) to a module-scoped cache using a Map with stringified options, preventing repeated instantiation inside the render loop without imposing restrictive default options.
