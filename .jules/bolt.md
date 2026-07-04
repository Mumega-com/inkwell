## 2024-05-24 - [Intl.NumberFormat Rendering Bottleneck]
 **Learning:** Instantiating `Intl.NumberFormat` is an expensive operation that can cause significant CPU overhead and trigger unnecessary garbage collection when called inside tight render loops like React components (e.g. data tables, charts).
 **Action:** Cache expensive formatter instances (like `Intl.NumberFormat` and `Intl.DateTimeFormat`) at the module level using a memoized mapping utility based on locale and deterministic stringified options, preventing recurrent object re-creation on every render.
