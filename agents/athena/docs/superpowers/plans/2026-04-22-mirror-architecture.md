# Mirror Architecture Roadmap

> **STATUS: COMPLETED — 2026-04-22**
> All sprints shipped. Mirror is a first-class SOS microkernel. See `/home/mumega/mirror/CHANGELOG.md` for full record.
> Remaining backlog: three-source blending, temporal/entity layer, surprisal scoring, forgetting policy (all LOW/MEDIUM priority).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Mirror from a standalone FastAPI memory service into a secure, durable, SOS-native memory layer that powers the full Mumega content automation pipeline.

**Architecture:** Mirror stays as its own service but becomes a first-class SOS plugin — unified auth via SOS bus tokens, health monitored by SOS, bus subscriber built-in, and a clean MemoryPort SDK consumed by Inkwell and all agents. The SOS memory proxy layer is removed; components call Mirror directly.

**Tech Stack:** Python 3.11, FastAPI, PostgreSQL + pgvector, Cloudflare Workers (Hono), TypeScript, SOS bus (Redis SSE), wrangler

---

## Ownership

| Role | Agent | Scope |
|------|-------|-------|
| Mirror PM + Gatekeeper | Athena | Architecture, spec, review, quality gate |
| SOS platform | Loom | Auth, service registry, bus subscriber, infra |
| Inkwell + mumega.com | Kasra | MemoryPort SDK, content pipeline, deploy |

---

## Sprint 0 — Security (URGENT, Loom owns)

> Nothing else ships until these are done. No backups = no production.

### Task S0-1: Restore PostgreSQL Backups (CRITICAL)

**Why:** No active DB backup exists. The backup script is archived. If the Hetzner VPS is lost, Mirror data is gone permanently.

**Files:**
- Create: `~/scripts/backup-mirror.sh`
- Modify: `/home/mumega/scripts/.archive/backup-to-r2.sh` → move to active location
- Modify: crontab (`crontab -e`)

- [ ] **Step 1: Rotate the exposed Cloudflare token**
  - The archived script contains hardcoded CF credentials. Rotate immediately:
  ```bash
  # Go to dash.cloudflare.com → My Profile → API Tokens
  # Delete token: WFBrSTwCbLGlij2CuWDh909bBY1-3MECW2UxY8_K
  # Create new token with R2 write scope only
  # Store as secret, NOT in script
  npx wrangler secret put CF_BACKUP_TOKEN
  ```

- [ ] **Step 2: Create clean backup script**
  ```bash
  # ~/scripts/backup-mirror.sh
  #!/bin/bash
  set -euo pipefail
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  DUMP_FILE="/tmp/mirror_backup_${TIMESTAMP}.sql.gz"
  
  pg_dump -U mirror mirror | gzip > "$DUMP_FILE"
  
  # Upload to R2 via wrangler (no hardcoded credentials)
  wrangler r2 object put "mumega-backups/mirror/${TIMESTAMP}.sql.gz" \
    --file "$DUMP_FILE" --remote
  
  rm -f "$DUMP_FILE"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete: ${TIMESTAMP}"
  ```

- [ ] **Step 3: Wire cron (daily at 02:00 UTC)**
  ```bash
  crontab -e
  # Add:
  0 2 * * * /home/mumega/scripts/backup-mirror.sh >> /home/mumega/.mumega/logs/mirror-backup.log 2>&1
  ```

- [ ] **Step 4: Run backup manually and verify R2 object exists**
  ```bash
  bash ~/scripts/backup-mirror.sh
  wrangler r2 object list mumega-backups --remote | grep mirror
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add ~/scripts/backup-mirror.sh
  git commit -m "fix(mirror): restore daily PostgreSQL backups to R2"
  ```

---

### Task S0-2: Fix SQL Injection in db.py Query Builder

**Why:** Table and column names in the query builder (`db.py`) are constructed via f-strings without validation. If any caller path allows user-controlled input to reach these fields, arbitrary SQL is possible.

**File:** `/home/mumega/mirror/kernel/db.py` (lines ~118, ~140, ~143)

- [ ] **Step 1: Read the vulnerable section**
  ```python
  # Lines ~115-145 in db.py — the QueryBuilder class
  # Specifically: f"SELECT {self._columns} FROM {self._table}"
  # And: f" ORDER BY {self._order}"
  # And: f" LIMIT {self._limit}"
  ```

- [ ] **Step 2: Add an allowlist validator**
  ```python
  # Add at top of db.py after imports
  _ALLOWED_TABLES = frozenset({"mirror_engrams", "mirror_code_nodes"})
  _ALLOWED_COLUMNS = frozenset({
      "id", "context_id", "agent", "text", "project", "workspace_id",
      "owner_type", "owner_id", "epistemic_truths", "core_concepts",
      "affective_vibe", "energy_level", "next_attractor", "metadata",
      "created_at", "updated_at", "*",
  })
  _ALLOWED_ORDER = frozenset({
      "created_at DESC", "created_at ASC", "updated_at DESC", "id DESC",
  })

  def _validate_identifier(value: str, allowed: frozenset[str], name: str) -> str:
      if value not in allowed:
          raise ValueError(f"Invalid {name}: {value!r}")
      return value
  ```

- [ ] **Step 3: Apply validator in QueryBuilder.__init__ or where fields are set**
  ```python
  self._table = _validate_identifier(table, _ALLOWED_TABLES, "table")
  self._columns = _validate_identifier(columns, _ALLOWED_COLUMNS, "columns")
  self._order = _validate_identifier(order, _ALLOWED_ORDER, "order")
  self._limit = int(limit)  # cast to int — raises ValueError if non-numeric
  ```

- [ ] **Step 4: Run Mirror tests**
  ```bash
  cd /home/mumega/mirror
  python -m pytest tests/ -v 2>/dev/null || python -m pytest -v
  ```
  Expected: all pass (no functional change, only input validation added)

- [ ] **Step 5: Commit**
  ```bash
  git add kernel/db.py
  git commit -m "fix(security): allowlist table/column names in query builder"
  ```

---

### Task S0-3: Consolidate Duplicate systemd Units

**Why:** Two Mirror systemd units exist (`/etc/systemd/system/mirror-api.service` and `~/.config/systemd/user/mirror.service`). Both point to port 8844 — one may shadow the other causing the April restart loop.

- [ ] **Step 1: Identify which unit is actually serving requests**
  ```bash
  systemctl status mirror.service
  systemctl --user status mirror.service
  curl -s http://localhost:8844/health | python3 -m json.tool
  ```

- [ ] **Step 2: Disable the system-level unit (keep user-level)**
  ```bash
  # User-level is preferred (runs as mumega, no sudo needed)
  sudo systemctl stop mirror-api.service
  sudo systemctl disable mirror-api.service
  sudo systemctl mask mirror-api.service
  ```

- [ ] **Step 3: Verify user service is serving**
  ```bash
  systemctl --user status mirror.service
  curl -s http://localhost:8844/health
  ```
  Expected: `{"status": "ok", ...}`

- [ ] **Step 4: Commit the decision in a comment**
  ```bash
  # Add note to /home/mumega/.config/systemd/user/mirror.service
  # [Unit]
  # Description=Mirror Memory API
  # Note: system-level mirror-api.service masked — use user unit only
  systemctl --user daemon-reload
  ```

---

## Sprint 1 — MemoryPort Contract (Kasra + Athena, parallel)

### Task K1-1: MemoryPort TypeScript Module (Kasra)

**Goal:** Clean adapter that wraps Mirror's SOS bus interface so Inkwell can store and recall content without knowing Mirror internals.

**Files:**
- Create: `workers/inkwell-api/src/lib/memory-port.ts`

- [ ] **Step 1: Write the module**

  ```typescript
  // workers/inkwell-api/src/lib/memory-port.ts
  
  export interface ContentEngram {
    slug: string
    title: string
    description: string
    tags: string[]
    type: string
    publishedAt: string
    url: string
  }
  
  export interface RecallResult {
    id: string
    text: string
    score: number
    metadata: Record<string, unknown>
  }
  
  export class MemoryPort {
    private readonly busUrl: string
    private readonly token: string
  
    constructor(busUrl: string, token: string) {
      this.busUrl = busUrl.replace(/\/$/, '')
      this.token = token
    }
  
    async storeContent(engram: ContentEngram): Promise<void> {
      const body = {
        agent: 'inkwell',
        context_id: `content:${engram.slug}`,
        text: `${engram.title}. ${engram.description}. Tags: ${engram.tags.join(', ')}`,
        project: 'mumega-com',
        epistemic_truths: engram.tags,
        core_concepts: [engram.title, ...engram.tags],
        metadata: {
          slug: engram.slug,
          url: engram.url,
          type: engram.type,
          published_at: engram.publishedAt,
        },
      }
      const res = await fetch(`${this.busUrl}/remember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`MemoryPort.storeContent failed: ${res.status}`)
    }
  
    async recallContent(query: string, limit = 5): Promise<RecallResult[]> {
      const res = await fetch(`${this.busUrl}/recall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query, limit }),
      })
      if (!res.ok) return []
      const data = await res.json() as { results?: RecallResult[] }
      return data.results ?? []
    }
  }
  
  export function makeMemoryPort(
    sosUrl: string | undefined,
    token: string | undefined,
  ): MemoryPort | null {
    if (!sosUrl || !token) return null
    return new MemoryPort(sosUrl, token)
  }
  ```

- [ ] **Step 2: Add `SOS_BUS_URL` and `INKWELL_MCP_TOKEN` to wrangler.toml `[vars]` if not present**

  ```toml
  # workers/inkwell-api/wrangler.toml — under [vars]
  SOS_BUS_URL = ""          # set in prod via wrangler secret
  INKWELL_MCP_TOKEN = ""    # set in prod via wrangler secret
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add workers/inkwell-api/src/lib/memory-port.ts workers/inkwell-api/wrangler.toml
  git commit -m "feat(memory-port): add MemoryPort adapter for Mirror integration"
  ```

---

### Task K1-2: Wire Content Publish → Mirror (Kasra)

**File:** `workers/inkwell-api/src/routes/content.ts`

- [ ] **Step 1: Import MemoryPort in content.ts**
  ```typescript
  import { makeMemoryPort } from '../lib/memory-port'
  ```

- [ ] **Step 2: After successful D1 index write in the publish handler, fire-and-forget to Mirror**

  Find the section in `/api/content/publish` after `INSERT INTO content_index` (around line 150-160). Add:
  ```typescript
  // Fire-and-forget — non-blocking, failure doesn't affect publish
  const memory = makeMemoryPort(env.SOS_BUS_URL, env.INKWELL_MCP_TOKEN)
  if (memory) {
    memory.storeContent({
      slug: body.slug,
      title: body.title ?? body.slug,
      description: body.description ?? '',
      tags: body.tags ?? [],
      type: body.type ?? 'blog',
      publishedAt: new Date().toISOString(),
      url: `/blog/${body.slug}`,
    }).catch(() => {}) // intentionally swallow — Mirror outage must not break publish
  }
  ```

- [ ] **Step 3: Apply the same pattern in the MCP `publish_content` tool handler**

  In `workers/inkwell-api/src/routes/mcp.ts` around lines 217-274, after content is stored:
  ```typescript
  const memory = makeMemoryPort(env.SOS_BUS_URL, env.INKWELL_MCP_TOKEN)
  if (memory) {
    memory.storeContent({
      slug: params.slug,
      title: params.title ?? params.slug,
      description: params.description ?? '',
      tags: params.tags ?? [],
      type: 'blog',
      publishedAt: new Date().toISOString(),
      url: `/blog/${params.slug}`,
    }).catch(() => {})
  }
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add workers/inkwell-api/src/routes/content.ts workers/inkwell-api/src/routes/mcp.ts
  git commit -m "feat(content): store engram to Mirror on publish"
  ```

---

### Task K1-3: Add recall_content MCP Tool (Kasra)

**File:** `workers/inkwell-api/src/routes/mcp.ts`

- [ ] **Step 1: Add `recall_content` to the tools list**

  Find the `tools` array in the MCP route (around line 50-100) and add:
  ```typescript
  {
    name: 'recall_content',
    description: 'Search Mirror memory for previously published content. Use before drafting to detect duplicates or find related articles.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or keywords to search for' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  }
  ```

- [ ] **Step 2: Add handler in the tool dispatch switch**
  ```typescript
  case 'recall_content': {
    const memory = makeMemoryPort(env.SOS_BUS_URL, env.INKWELL_MCP_TOKEN)
    if (!memory) {
      return c.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Memory not configured' }] } })
    }
    const results = await memory.recallContent(params.query as string, params.limit as number ?? 5)
    return c.json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: results.length
            ? results.map(r => `[${r.score.toFixed(2)}] ${r.text}`).join('\n')
            : 'No related content found in memory.',
        }],
      },
    })
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add workers/inkwell-api/src/routes/mcp.ts
  git commit -m "feat(mcp): add recall_content tool for pre-draft dedup"
  ```

---

### Task K1-4: Deploy inkwell-api with Mirror wired (Kasra)

- [ ] **Step 1: Set production secrets**
  ```bash
  cd workers/inkwell-api
  echo "https://mcp.mumega.com" | npx wrangler secret put SOS_BUS_URL
  # INKWELL_MCP_TOKEN: use the existing token from SOS tokens registry
  npx wrangler secret put INKWELL_MCP_TOKEN
  ```

- [ ] **Step 2: Deploy**
  ```bash
  cd workers/inkwell-api
  npx wrangler deploy
  ```

- [ ] **Step 3: Smoke test — publish a test post and verify engram in Mirror**
  ```bash
  # Publish test content via MCP
  curl -s -X POST https://inkwell-api.mumega-workers.workers.dev/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INKWELL_TOKEN" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recall_content","arguments":{"query":"test article"}}}'
  ```

- [ ] **Step 4: Send Athena confirmation on SOS bus**
  ```bash
  # Signal Athena that Inkwell is wired
  python3 -c "
  import requests
  requests.post('http://localhost:6070/mcp', 
    headers={'Authorization': 'Bearer $KASRA_TOKEN'},
    json={'method': 'send', 'params': {'to': 'athena', 'text': 'Kasra: Inkwell MemoryPort deployed. recall_content tool live. Smoke test passed.'}}
  )
  "
  ```

---

### Task A1-1: Wire Athena Workspace → Mirror (Athena)

**Goal:** This session can store and recall engrams from Mirror directly.

- [ ] **Step 1: Test current Mirror connectivity**
  ```bash
  curl -s http://localhost:8844/health
  ```
  Expected: `{"status": "ok"}`

- [ ] **Step 2: Test recall (Athena token)**
  ```bash
  curl -s -X POST http://localhost:8844/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -d '{"query": "memory architecture", "limit": 3}'
  ```

- [ ] **Step 3: Store a test engram from Athena**
  ```bash
  curl -s -X POST http://localhost:8844/store \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -d '{
      "agent": "athena",
      "context_id": "mirror-audit-2026-04-22",
      "text": "Mirror architecture audit complete. Security findings: no active backup, SQL injection risk in QueryBuilder, dual systemd units. Roadmap created.",
      "project": "sos",
      "epistemic_truths": ["audit", "mirror", "security", "architecture"],
      "core_concepts": ["Mirror", "MemoryPort", "backup", "SQL injection"],
      "affective_vibe": "Analytical"
    }'
  ```

- [ ] **Step 4: Verify Athena's engram is stored**
  ```bash
  curl -s -X POST http://localhost:8844/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -d '{"query": "mirror architecture audit", "limit": 1}'
  ```
  Expected: score > 0.7, text matches stored engram.

---

## Sprint 2 — Mirror as SOS Native Service (Loom owns)

> Mirror stays at :8844 but becomes a registered SOS module with unified auth and built-in bus subscriber.

### Task L2-1: Unified Auth — SOS Bus Tokens in Mirror

**Goal:** Remove the separate `tenant_keys.json`. SOS bus tokens work in Mirror natively via the same verification path.

**Files:**
- Modify: `/home/mumega/mirror/kernel/auth.py`
- Coordinate: `/home/mumega/SOS/sos/bus/tokens.json` (SOS token registry)

- [ ] **Step 1: Add SOS token verification to Mirror auth cascade**

  In `auth.py`, after checking `tenant_keys.json`, add SOS bus token verification:
  ```python
  # In resolve_token_context(), after tenant_keys check:
  try:
      from sos.services.auth import verify_bearer
      ctx = verify_bearer(token)
      if ctx:
          return TokenContext(
              workspace_id=ctx.get("project"),
              owner_type="agent",
              owner_id=ctx.get("agent"),
              is_admin=False,
          )
  except ImportError:
      pass  # SOS not available — fall through
  ```

- [ ] **Step 2: Migrate existing agents from tenant_keys.json → SOS bus tokens**
  - List all active entries in `tenant_keys.json`
  - For each agent slug, verify a SOS bus token exists in `SOS/sos/bus/tokens.json`
  - For agents missing a SOS token, generate one:
    ```bash
    python3 -c "import secrets; print('sk-bus-' + name + '-' + secrets.token_hex(16))"
    ```
  - Add to `SOS/sos/bus/tokens.json` with correct project scope

- [ ] **Step 3: Deprecate tenant_keys.json (keep as fallback for 30 days)**
  ```python
  # Add deprecation warning in auth.py when a tenant_keys.json token is used:
  import warnings
  warnings.warn(f"tenant_keys.json token used by {ctx['agent_slug']} — migrate to SOS bus token", DeprecationWarning)
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add kernel/auth.py
  git commit -m "feat(auth): add SOS bus token verification to Mirror auth cascade"
  ```

---

### Task L2-2: Register Mirror as SOS Service Module

**Goal:** Mirror health appears in SOS health check. SOS knows Mirror's address, version, and status.

**Files:**
- Modify: `/home/mumega/SOS/sos/services/engine.py` or service registry
- Modify: `/home/mumega/SOS/sos/services/health.py`

- [ ] **Step 1: Find the SOS service registry pattern**
  ```bash
  grep -r "register_service\|service_registry\|health_check" /home/mumega/SOS/sos/services/ -l
  ```

- [ ] **Step 2: Register Mirror**
  ```python
  # In the SOS service registry or engine startup:
  registry.register("mirror", {
      "url": os.getenv("MIRROR_URL", "http://localhost:8844"),
      "health_endpoint": "/health",
      "critical": True,   # SOS degraded if Mirror is down
  })
  ```

- [ ] **Step 3: Add Mirror to the SOS health endpoint response**
  ```python
  # In health check:
  mirror_ok = await check_service_health("http://localhost:8844/health")
  services["mirror"] = "ok" if mirror_ok else "degraded"
  ```

- [ ] **Step 4: Restart SOS engine and verify**
  ```bash
  systemctl --user restart sos-engine
  curl -s http://localhost:6060/health | python3 -m json.tool
  # Expected: "mirror": "ok" in services section
  ```

---

### Task L2-3: Move Bus Subscriber into Mirror Plugin

**Goal:** Consolidate `mirror_bus_consumer.service` into Mirror as a plugin — one less moving part.

**Files:**
- Modify: `/home/mumega/mirror/mirror_api.py` (startup hook)
- Create: `/home/mumega/mirror/plugins/bus_subscriber/subscriber.py`
- Deprecate: `/home/mumega/.config/systemd/user/mirror_bus_consumer.service`

- [ ] **Step 1: Copy bus subscriber logic into Mirror plugin**
  ```bash
  # Read existing subscriber
  cat /home/mumega/SOS/sos/skills/registry/mirror_bus_subscriber.json
  # Find the actual Python subscriber script
  grep -r "mirror_bus_consumer\|bus_consumer" /home/mumega/SOS/ -l
  ```

- [ ] **Step 2: Wire into Mirror startup as a background thread**
  ```python
  # In mirror_api.py startup (lifespan handler):
  from plugins.bus_subscriber.subscriber import start_bus_subscriber
  
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Start bus subscriber as background task
      subscriber_task = asyncio.create_task(start_bus_subscriber())
      yield
      subscriber_task.cancel()
  ```

- [ ] **Step 3: Disable the standalone systemd unit**
  ```bash
  systemctl --user stop mirror_bus_consumer.service
  systemctl --user disable mirror_bus_consumer.service
  systemctl --user restart mirror.service  # starts subscriber within Mirror
  ```

- [ ] **Step 4: Verify subscriber still working**
  ```bash
  journalctl --user -u mirror.service -n 50 | grep -i subscriber
  # Expected: "Bus subscriber started" log line
  ```

---

## Sprint 3 — Infrastructure Hardening (Loom + Kasra)

### Task L3-1: halfvec Migration

**Goal:** Halve Mirror's PostgreSQL storage with pgvector's halfvec type (16-bit floats instead of 32-bit).

**File:** `/home/mumega/mirror/kernel/db.py`

- [ ] **Step 1: Check pgvector version supports halfvec**
  ```sql
  SELECT extversion FROM pg_extension WHERE extname = 'vector';
  -- halfvec requires pgvector >= 0.7.0
  ```

- [ ] **Step 2: Create migration script**
  ```sql
  -- migrations/001_halfvec.sql
  ALTER TABLE mirror_engrams 
    ALTER COLUMN embedding TYPE halfvec(1536) 
    USING embedding::halfvec(1536);
  
  DROP INDEX IF EXISTS mirror_engrams_embedding_idx;
  CREATE INDEX mirror_engrams_embedding_idx 
    ON mirror_engrams USING hnsw (embedding halfvec_cosine_ops);
  ```

- [ ] **Step 3: Run migration in a transaction with rollback plan**
  ```bash
  psql -U mirror mirror -c "BEGIN;"
  psql -U mirror mirror -f migrations/001_halfvec.sql
  # Test a search query works
  psql -U mirror mirror -c "ROLLBACK;"  # if anything fails
  psql -U mirror mirror -c "COMMIT;"    # if search works
  ```

- [ ] **Step 4: Verify storage reduction**
  ```sql
  SELECT pg_size_pretty(pg_total_relation_size('mirror_engrams'));
  ```

---

### Task L3-2: Add Mirror to SOS Medic Watchdog

**Goal:** `sos-medic` should auto-restart Mirror if health check fails, and alert on Discord.

- [ ] **Step 1: Find sos-medic config**
  ```bash
  cat /home/mumega/SOS/sos/services/medic/config.json 2>/dev/null || \
  grep -r "medic\|watchdog" /home/mumega/SOS/ -l | head -5
  ```

- [ ] **Step 2: Add Mirror to medic watch list**
  ```json
  {
    "services": [
      { "name": "mirror", "url": "http://localhost:8844/health", "restart_cmd": "systemctl --user restart mirror" }
    ]
  }
  ```

---

## Sprint 4 — Memory Intelligence (Kasra + Athena, after Sprint 2)

### Task M4-1: Hybrid Search (BM25 + Vector + RRF)

**Goal:** Improve recall quality by blending full-text BM25 search with cosine similarity, reranked with Reciprocal Rank Fusion.

**File:** `/home/mumega/mirror/kernel/db.py` + `/home/mumega/mirror/plugins/memory/routes.py`

- [ ] **Step 1: Add `tsvector` column to mirror_engrams**
  ```sql
  ALTER TABLE mirror_engrams ADD COLUMN text_tsv tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;
  CREATE INDEX mirror_engrams_tsv_idx ON mirror_engrams USING GIN(text_tsv);
  ```

- [ ] **Step 2: Add BM25 search function in db.py**
  ```python
  async def search_bm25(self, query: str, limit: int, workspace_id: str) -> list[dict]:
      async with self.pool.acquire() as conn:
          rows = await conn.fetch(
              """SELECT id, context_id, text, agent, metadata,
                        ts_rank_cd(text_tsv, plainto_tsquery('english', $1)) as rank
                 FROM mirror_engrams
                 WHERE text_tsv @@ plainto_tsquery('english', $1)
                   AND workspace_id = $2
                 ORDER BY rank DESC LIMIT $3""",
              query, workspace_id, limit,
          )
      return [dict(r) for r in rows]
  ```

- [ ] **Step 3: Implement RRF blending in search route**
  ```python
  # In routes.py /search endpoint:
  async def rrf_blend(vector_results, bm25_results, k=60):
      scores = {}
      for rank, doc in enumerate(vector_results):
          scores.setdefault(doc["id"], 0)
          scores[doc["id"]] += 1 / (k + rank + 1)
      for rank, doc in enumerate(bm25_results):
          scores.setdefault(doc["id"], 0)
          scores[doc["id"]] += 1 / (k + rank + 1)
      all_docs = {d["id"]: d for d in vector_results + bm25_results}
      return sorted(all_docs.values(), key=lambda d: scores[d["id"]], reverse=True)
  ```

---

## Quality Gate (Athena — all sprints)

Every PR touching Mirror must be reviewed by Athena before merge. Checklist:

- [ ] Auth: no new hardcoded tokens or credentials
- [ ] SQL: all user-facing inputs parameterized or allowlisted
- [ ] Workspace isolation: workspace_id filter present on all queries returning stored data
- [ ] Fire-and-forget: Mirror outage must never block a non-memory operation (Inkwell publish, bus send)
- [ ] Tests: new paths have tests, existing tests pass
- [ ] Backup: any schema changes include a migration script

---

## Summary

| Sprint | Owner | Tasks | Priority |
|--------|-------|-------|----------|
| 0 — Security | Loom | Backups, SQL fix, unit consolidation | URGENT |
| 1 — MemoryPort | Kasra + Athena | SDK, publish hook, recall tool, deploy, wire Athena | HIGH |
| 2 — SOS Integration | Loom | Unified auth, service registry, bus subscriber merge | HIGH |
| 3 — Infra | Loom + Kasra | halfvec, medic watchdog | MEDIUM |
| 4 — Intelligence | Kasra + Athena | Hybrid search, surprisal, forgetting policy | LOW |
