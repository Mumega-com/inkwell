## 2025-05-18 - [Preventing Intl garbage collection overhead]
 **Learning:** In React components, instantiating `new Intl.NumberFormat()` during every render, especially inside loops (e.g. data tables, invoice lists), introduces significant CPU and garbage collection overhead.
 **Action:** Always cache and reuse `Intl.NumberFormat` instances at the module level using a memoized utility function (like `src/lib/formatters.ts`) to avoid repetitive initializations.
