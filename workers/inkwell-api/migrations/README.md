# D1 Migrations

Wrangler manages migrations automatically. Each D1 database has its own subdirectory:

```
migrations/
  core/        -> DB_CORE (inkwell-core)
  analytics/   -> DB_ANALYTICS (inkwell-analytics)
  marketing/   -> DB_MARKETING (inkwell-marketing)
```

## Creating a migration

```bash
cd workers/inkwell-api
npx wrangler d1 migrations create inkwell-core "description_here"
```

This creates a numbered SQL file in the correct subdirectory (e.g. `migrations/core/0001_description_here.sql`). Edit the file to add your SQL statements.

## Running migrations

```bash
npm run migrate        # apply all pending migrations locally
npm run migrate:prod   # apply all pending migrations to production
```

## Convention

- One migration per logical change
- Migrations are append-only -- never edit a migration that has been applied
- Use descriptive names: `create_leads_table`, `add_status_to_contracts`
