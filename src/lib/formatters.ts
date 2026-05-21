// Performance Optimization: Cache Intl.NumberFormat instances
// Instantiating Intl.NumberFormat is expensive. Caching them at the module level
// avoids recreation on every component render, reducing CPU and GC overhead.

export const formatters = {
  currencyCAD: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }),
  currencyCAD2: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  compactCAD: new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }),
  compactCAD0: new Intl.NumberFormat('en-CA', { notation: 'compact' }),
  currencyUSD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};
