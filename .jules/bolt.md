## 2025-06-07 - Cache Intl.NumberFormat
**Learning:** Instantiating `Intl.NumberFormat` repeatedly inside React render loops or frequently called helper functions causes measurable CPU overhead and unnecessary garbage collection.
**Action:** When working with formatting APIs in frontend components, always cache instances (e.g., in a Map using a module-level variable) to share across the application rather than creating them inline.

## 2025-06-07 - Worker Deployment Requirement
**Learning:** The Cloudflare worker deployment (`npx wrangler deploy`) in this project relies on the Astro server entrypoint (`@astrojs/cloudflare/entrypoints/server`).
**Action:** Always execute `npm run build` before running `wrangler deploy` to generate this required entrypoint, as missing it causes Wrangler to fail with `The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found.`
