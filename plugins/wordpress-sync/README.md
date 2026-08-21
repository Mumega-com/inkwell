# WordPress Sync Plugin

Mirrors published WordPress posts and pages into Inkwell.

## What it owns

- Fetching WordPress REST content.
- Normalizing content into Inkwell markdown plus frontmatter.
- Writing `CONTENT` KV keys.
- Upserting `DB_ANALYTICS.content_index` rows.
- Tracking connector accounts and runs in `DB_MARKETING`.

## Configuration

Required:

- `WORDPRESS_SITE_URL`

Optional:

- `WORDPRESS_CUSTOMER_SLUG`
- `WORDPRESS_AUTH_HEADER`
- `WORDPRESS_USERNAME`
- `WORDPRESS_APP_PASSWORD`

## Interfaces

- Scheduled hook: runs when the Inkwell Worker cron runs.
- MCP tool: `sync_wordpress_content`
- Admin routes:
  - `POST /api/wordpress-sync/run`
  - `GET /api/wordpress-sync/runs`

