# mcp-dispatcher

Cloudflare Worker — session-aware dispatcher for `mcp.mumega.com`.

Every agent from any platform (Claude Code, Claude Desktop, ChatGPT, Codex, Cursor, Perplexity, AntiGravity, custom clients) connects via MCP SSE to `mcp.mumega.com`. This Worker intercepts every connection, assigns it a session identity, registers it in KV, and proxies the full SSE/HTTP stream to the VPS origin — without touching token verification (that stays on the VPS).

---

## Session ID format

`session_id` is a 32-char lowercase hex string derived from:

```
SHA-256(token + ":" + ip + ":" + user-agent).slice(0, 32)
```

The same client reconnecting from the same IP with the same UA gets the same `session_id`, which lets the system track reconnects vs. new sessions via `connection_count`.

---

## KV schema

| Key | Value | TTL |
|-----|-------|-----|
| `session:{session_id}` | `SessionProfile` JSON | 30 days |
| `agent:{agent}:sessions` | `string[]` of session_ids (max 50) | none |

`SessionProfile` fields:

| Field | Description |
|-------|-------------|
| `session_id` | 32-char SHA-256 fingerprint |
| `token_prefix` | First 12 chars of token — never the full token |
| `agent` | Extracted from token format `sk-{agent}-{hex}` |
| `platform` | Inferred from User-Agent / `x-sos-client` header |
| `ip` | `CF-Connecting-IP` |
| `connected_at` | ISO 8601, first connection |
| `last_seen` | ISO 8601, most recent connection |
| `connection_count` | Incremented on every reconnect |

---

## Adding new platform detection patterns

Edit `inferPlatform()` in `src/index.ts`. The function receives the lowercased `User-Agent` string and the full `Headers` object. Add a check before the `return 'unknown'` line:

```typescript
if (u.includes('my-client')) return 'my-client'
```

Clients can also self-identify by sending the `x-sos-client: my-platform` request header — `inferPlatform` already reads this as a fallback.

---

## Environment variables

| Name | Where | Description |
|------|-------|-------------|
| `SOS_ORIGIN` | `wrangler.toml [vars]` | VPS origin URL. Must NOT be `mcp.mumega.com` (would loop). Use `sos-mcp-origin.mumega.com` or a direct IP. |
| `SESSIONS` | `wrangler.toml [[kv_namespaces]]` | KV namespace binding for session registry. |

---

## Deploy checklist

1. `npx wrangler kv:namespace create SESSIONS` → paste the returned `id` into `wrangler.toml`
2. Add a DNS record / nginx vhost for `sos-mcp-origin.mumega.com` pointing to the VPS (bypasses this Worker)
3. `npm run deploy`
4. Verify: `curl https://mcp.mumega.com/health`
