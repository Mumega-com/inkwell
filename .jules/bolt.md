## 2024-06-10 - [Intl.NumberFormat Optimization]
 **Learning:** [Repeated instantiation of Intl.NumberFormat objects is a known performance bottleneck in JS/React rendering. This app creates multiple formatters per render loop (e.g. lists or tables).]
 **Action:** [Use a centralized formatter module to cache formatters via a Map, ensuring options and combinations match what is expected.]
