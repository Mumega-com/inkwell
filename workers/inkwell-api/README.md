# Inkwell API

Cloudflare Worker runtime for Inkwell edge APIs.

## v4 Data Layout

`Inkwell v4` keeps one Worker runtime and splits persistence by concern.

- `DB_ANALYTICS`: existing content/engagement analytics
- `DB_CORE`: auth identities, quote requests, shipment timeline, document checklists
- `DB_MARKETING`: connector accounts, sync runs, normalized marketing snapshots
- `CONTENT`: markdown + content metadata
- `SESSIONS`: short-lived auth/session state in KV

## Migrations

Local apply:

```bash
npm run migrate:analytics:local
npm run migrate:core:local
npm run migrate:marketing:local
```

Remote apply:

```bash
npm run migrate:analytics:remote
npm run migrate:core:remote
npm run migrate:marketing:remote
```

## Notes

- `wrangler.toml` currently contains placeholder IDs for the new `DB_CORE`,
  `DB_MARKETING`, and `SESSIONS` bindings. Replace them with real Cloudflare
  resource IDs before deploy.
- The existing routes still read from `DB_ANALYTICS`; new auth, portal, and
  connector routes should target `DB_CORE` and `DB_MARKETING`.
