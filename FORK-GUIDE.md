# Fork Guide

Practical setup guide for forking Inkwell. Current version: **v8.0**.

---

## Quick Start (Recommended)

```bash
npx create-inkwell my-site --domain example.com
cd my-site
npm install
```

This clones Inkwell, generates your config, and initializes a fresh git repo. Skip to [Step 4: Create Cloudflare Resources](#4-create-cloudflare-resources) if using this method.

---

## Manual Setup

### 1. Prerequisites

- **Cloudflare account** (free tier works for production)
- **Node.js 20+** and npm
- **Wrangler CLI**: `npm install -g wrangler` then `wrangler login`
- **Git**

### 2. Fork & Clone

```bash
git clone https://github.com/servathadi/inkwell
cd inkwell
npm install
```

### 3. Configure

Everything lives in `inkwell.config.ts`. Copy the example and edit:

```bash
cp inkwell.config.example.ts inkwell.config.ts
```

Key fields to change:
- `name` — your site name
- `domain` — your domain (e.g. `example.com`)
- `theme.colors.primary` — your brand color
- `seo.organization` — your business info

### 4. Create Cloudflare Resources

```bash
cd workers/inkwell-api

# Create D1 databases
npx wrangler d1 create my-site-core
npx wrangler d1 create my-site-analytics
npx wrangler d1 create my-site-marketing

# Create KV namespaces
npx wrangler kv namespace create CONTENT
npx wrangler kv namespace create SESSIONS

# Create R2 bucket (for media uploads)
npx wrangler r2 bucket create my-site-media
```

Copy the IDs from the output into `workers/inkwell-api/wrangler.toml`:
- `account_id` — your Cloudflare account ID
- `database_id` for each `[[d1_databases]]` block
- `id` for each `[[kv_namespaces]]` block

### 5. Set Secrets

```bash
# Required: system auth token (generate a strong random string)
npx wrangler secret put PUBLISH_TOKEN

# Optional: MCP token for AI agents
npx wrangler secret put INKWELL_MCP_TOKEN
```

Never put real tokens in `wrangler.toml`. The dev token there is for local development only.

### 6. Deploy

```bash
npm run deploy
```

Migrations run automatically on first request — no manual `wrangler d1 migrations apply` needed.

### 7. Connect Your AI Agent

After deploying, visit `https://your-domain.com/mcp/connect` to get connection configs for:

- **Claude Code** — add to `.mcp.json`
- **Claude Desktop** — add to `claude_desktop_config.json`
- **Cursor** — add to `.cursor/mcp.json`
- **ChatGPT** — add in Settings → Connectors

All use Streamable HTTP transport (POST to `/mcp`).

---

## Custom Domain

1. Add your domain to Cloudflare DNS
2. Update `wrangler.toml`:
   ```toml
   [[routes]]
   pattern = "*.yourdomain.com/*"
   zone_name = "yourdomain.com"
   ```
3. Update `SITE_URL` in `wrangler.toml` `[vars]`
4. Redeploy: `npm run deploy`

---

## Provider-Agnostic (Non-Cloudflare)

Inkwell v8 supports running on any infrastructure. The kernel defines port interfaces; adapters implement them.

**Available adapters:**
| Port | Cloudflare | Alternative |
|------|-----------|-------------|
| DatabasePort | D1 (default) | Postgres (via `PostgresDatabaseAdapter`) |
| StoragePort | R2 (default) | S3-compatible (via `S3StorageAdapter`) |
| SessionPort | KV (default) | Redis (via `RedisSessionAdapter`) |
| ContentPort | KV (default) | Filesystem (via `FileContentAdapter`) |

To use alternative adapters, set the corresponding env vars:
- `DB_CORE_CLIENT` / `DB_ANALYTICS_CLIENT` / `DB_MARKETING_CLIENT` — a PgClient instance
- `REDIS_CLIENT` — a Redis client
- `S3_CLIENT` — an S3 client
- `FS_CLIENT` + `CONTENT_DIR` — a filesystem client

See `kernel/adapters/` for adapter implementations and interfaces.

---

## MCP Token Management

Inkwell supports per-tenant MCP tokens for multi-user deployments:

```bash
# Create a token (via API)
curl -X POST https://your-domain.com/mcp/tokens \
  -H "Authorization: Bearer $PUBLISH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-agent", "expires_in_days": 90}'

# List tokens
curl https://your-domain.com/mcp/tokens \
  -H "Authorization: Bearer $PUBLISH_TOKEN"

# Revoke a token (use the token prefix)
curl -X DELETE https://your-domain.com/mcp/tokens/mcp_abc1 \
  -H "Authorization: Bearer $PUBLISH_TOKEN"
```

---

## What NOT to Change

- `kernel/` — contracts only, never add business logic
- Plugin cross-imports — plugins must not import from other plugins
- Hardcoded URLs — all URLs come from config or env vars

See `CLAUDE.md` for the full list of microkernel rules.
