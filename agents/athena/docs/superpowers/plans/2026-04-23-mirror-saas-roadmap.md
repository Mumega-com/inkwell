# Mirror SaaS Roadmap — Multi-Tenant Memory Service

**Owner:** Athena (PM) · Kasra (Cloudflare/infra) · Loom (SOS integration)
**Status:** Planning — 2026-04-23
**Goal:** Mirror as a sellable, hosted memory service for AI teams — on Cloudflare, Google Cloud, or self-hosted.

---

## The Product

**Mirror is neutral, shared, cross-model team memory.**

Cloud providers (Anthropic, OpenAI, Google) all have per-user memory. None share across agents, none cross model boundaries, none are self-hostable. Mirror's position:

| | Cloud memory | Mirror SaaS |
|---|---|---|
| Shared across all team agents | ❌ | ✅ |
| Works with Claude + GPT + Gemini + Gemma | ❌ | ✅ |
| Self-hostable | ❌ | ✅ |
| Squad-level shared context | ❌ | ✅ |
| Your data, your infra | ❌ | ✅ |

**Target customers:**
- AI teams running multi-agent workflows (dev studios, automation shops)
- Companies building on top of multiple models who need shared agent context
- Individuals who want persistent memory across Claude.ai + ChatGPT + local models
- Mumega internal (SOS + Inkwell + all agents already running on it)

---

## Memory Hierarchy — Agent, Squad, Workspace

```
Workspace (billing unit / company)
├── Squad A (project team — e.g. "sos-dev")
│   ├── System messages (pinned, high-importance engrams — squad context)
│   ├── Agent: kasra     (personal namespace)
│   ├── Agent: loom      (personal namespace)
│   └── Agent: athena    (personal namespace)
├── Squad B (e.g. "content-team")
│   ├── System messages
│   ├── Agent: sol
│   └── Agent: worker
└── Personal mirrors (individual users — isolated)
    ├── User: hadi
    └── User: ...
```

**How squads work:**
- A squad has a `workspace_id = squad_id`
- All member agents share that workspace when storing/searching
- **System messages** = engrams tagged `memory_tier=system`, `pinned=true`, `importance=10.0` — loaded first in any recall
- Squads can set context like: "This squad builds SOS in Python 3.11. Always use FastAPI. See squad memory for architectural decisions."
- Personal agent memory uses `owner_type=agent, owner_id=agent_name` — searchable by that agent only unless squad-shared

**SOS Squad Service integration (`:8060`):**
- When a squad is created in SOS Squad Service, Mirror auto-creates the squad workspace
- Squad skills + pipeline config stored as system-message engrams
- Task completions auto-store as episodic engrams in squad workspace

---

## SOS Connection Guide

Mirror works standalone or natively integrated with SOS. Both modes are production-ready.

### Mode 1 — Standalone (no SOS)

```bash
# Start Mirror
python mirror_api.py

# Store via HTTP
curl -X POST http://localhost:8844/store \
  -H "Authorization: Bearer sk-workspace-token" \
  -d '{"agent": "mybot", "text": "user prefers dark mode", ...}'

# Search
curl -X POST http://localhost:8844/search \
  -H "Authorization: Bearer sk-workspace-token" \
  -d '{"query": "user preferences", "top_k": 5}'
```

Tokens issued via token issuance API (see Phase 1). No Redis, no SOS bus needed.

### Mode 2 — SOS Native (internal, no HTTP hop)

When SOS is on `PYTHONPATH`:
```python
# SOS imports Mirror kernel directly
from mirror.kernel.db import get_db
from mirror.kernel.embeddings import get_embedding

db = get_db()
embedding = get_embedding("user query")
results = db.search_engrams(embedding, threshold=0.5, limit=10, workspace_id="squad-sos")
```

Used by: `sos_mcp_sse.py` (recall tool), `sos/services/memory/core.py` (MemoryCore), bus subscriber daemon inside Mirror.

### Mode 3 — MCP (Claude Desktop / any MCP client)

```json
{
  "mcpServers": {
    "mirror": {
      "url": "http://your-server:8844/mcp/YOUR_TOKEN/sse"
    }
  }
}
```

MCP tools: `memory_search`, `memory_store`, `memory_recent`. Token in URL path (Claude Desktop requirement).

### Environment variables

```env
# Required
GEMINI_API_KEY=...          # Embeddings (free tier sufficient)
MIRROR_ADMIN_TOKEN=sk-...   # Admin access

# Backend (choose one)
MIRROR_BACKEND=local        # PostgreSQL (default, production)
MIRROR_BACKEND=sqlite       # SQLite (dev, offline, Pi)

# PostgreSQL
DATABASE_URL=postgresql://mirror:password@localhost:5432/mirror

# SOS integration (optional)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=...
PYTHONPATH=/home/youruser   # Enables mirror.kernel.* imports from SOS
```

---

## Deployment Options

### Option A — Self-Hosted (current, recommended for privacy)

**Stack:** Python 3.11 + FastAPI + PostgreSQL 14+ + pgvector ≥ 0.7.0

```bash
git clone https://github.com/Mumega-com/mirror.git
cd mirror
pip install fastapi uvicorn psycopg2-binary python-dotenv google-genai pydantic
psql mirror < schema.sql
for f in migrations/*.sql; do psql mirror < "$f"; done
python mirror_api.py
```

Cost: ~$5-6/month Hetzner VPS (current setup). Handles thousands of engrams, full hybrid search.

### Option B — Cloudflare Workers + Vectorize + D1

**Best for:** Teams already on Cloudflare, zero-ops, global edge, generous free tier.

**Architecture:**
```
Cloudflare Worker (Mirror API — Hono)
├── Vectorize              → vector search (replaces pgvector HNSW)
├── D1                     → engram metadata, full-text index
└── Workers AI             → embeddings (bge-small-en-v1.5, free)
```

**Constraints vs self-hosted:**
- No halfvec (Vectorize uses float32) — no storage issue at Cloudflare pricing
- No `tsvector` GIN (D1 is SQLite) — BM25 via FTS5 virtual table instead
- Workers AI embedding model is different — embedding space different from Gemini, not compatible with existing engrams
- 1MB Worker bundle limit — Mirror is Python, needs rewrite in TypeScript (Hono)

**Recommended path:** New TypeScript Worker implementing Mirror API contract. Existing Python Mirror stays for SOS-native mode. Cloudflare version targets personal/individual customers.

### Option C — Google Cloud Run + Cloud SQL + pgvector

**Best for:** Enterprise, large teams, need full PostgreSQL features.

```
Cloud Run (Mirror Python service, containerized)
├── Cloud SQL (PostgreSQL 15 + pgvector)
├── Vertex AI Embeddings    → replace Gemini direct API (same Google account)
└── Cloud Storage           → backups (replace R2)
```

**Advantages:** Scales to zero, pay-per-request, pgvector native — no architecture changes from self-hosted. Same Python codebase, just containerized.

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "mirror_api.py"]
```

### Option D — Docker Compose (for customers)

```yaml
version: '3.8'
services:
  mirror:
    image: mumega/mirror:latest
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATABASE_URL=postgresql://mirror:mirror@postgres:5432/mirror
    ports:
      - "8844:8844"
    depends_on:
      - postgres
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_USER=mirror
      - POSTGRES_PASSWORD=mirror
      - POSTGRES_DB=mirror
```

One command. Works on any Linux box, Mac, Windows with Docker.

---

## Phase 1 — Token Issuance API (CRITICAL — already in backlog)

Without this, SaaS is impossible. Customers need to create and manage their own workspace tokens.

**Endpoints:**
```
POST /admin/workspaces          → create workspace, returns workspace_id
POST /admin/workspaces/{id}/tokens → issue token for workspace
GET  /admin/workspaces/{id}/tokens → list tokens
DELETE /admin/workspaces/{id}/tokens/{token_id} → revoke
```

**Token types:**
- `admin` — full workspace access, can issue sub-tokens
- `agent:{name}` — scoped to agent namespace within workspace
- `squad:{name}` — scoped to squad namespace
- `readonly` — search only, no store

Storage: `mirror_tokens` table in PostgreSQL (replaces flat `tenant_keys.json`).

---

## Phase 2 — Squad Memory Collections

**What squads need:**
1. A shared workspace (already works via `workspace_id`)
2. **System messages** — pinned, high-importance engrams that load first in any recall:
   ```python
   # When creating a squad, store its context as system engrams
   db.upsert_engram({
       "text": "This squad builds SOS in Python 3.11 with FastAPI. See architectural decisions below.",
       "memory_tier": "system",
       "importance_score": 10.0,
       "pinned": True,
       "workspace_id": "squad-sos-dev",
   })
   ```
3. **Squad recall** — `/search` returns system messages first, then ranked engrams
4. **SOS Squad Service sync** — POST `/squads/{id}/sync` to Mirror creates/updates squad workspace from Squad Service config

**Squad system message examples:**
- "This squad works on DentalNearYou. Stack: Next.js 16, Cloudflare Workers, D1."
- "Default coding style: TypeScript strict, no any, Zod validation at boundaries."
- "Budget constraint: use free tier models (Gemma, Haiku) unless task requires reasoning."

---

## Phase 3 — Personal Mirrors (User-Isolated)

Each user gets their own isolated mirror. No cross-contamination with team memory.

```
workspace_id = "user:{user_id}"
owner_type = "user"
owner_id = user_id
```

Use cases:
- Individual Claude Desktop / ChatGPT users wanting persistent cross-session memory
- Per-user preference storage in Inkwell tenants
- "My personal assistant remembers me across models"

Token: issued at signup, scoped to `user:{user_id}` workspace only.

---

## Phase 4 — Usage Tracking + Billing Hooks

```sql
CREATE TABLE mirror_usage (
    workspace_id TEXT,
    date DATE,
    engrams_stored INT DEFAULT 0,
    searches_run INT DEFAULT 0,
    tokens_embedded BIGINT DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0
);
```

Billing tiers (suggested):
- **Free**: 1 workspace, 1k engrams, 100 searches/day
- **Team** ($9/mo): 5 workspaces, 50k engrams, unlimited search
- **Pro** ($29/mo): unlimited workspaces, 500k engrams, dreamer agent included
- **Self-hosted**: MIT license, free forever

---

## Open Questions for Hadi

1. **Cloudflare vs GCloud first?** CF is lower ops but requires TypeScript rewrite. GCloud is same codebase, more ops. Recommend: Docker Compose for customer self-host first (zero effort), then GCloud Cloud Run.

2. **Embedding model for CF deployment?** Workers AI (free) uses different embedding space than Gemini. Existing engrams can't be searched from CF instance unless we re-embed or use a cross-encoder reranker.

3. **Squad system messages UX** — do squads define them via API, or should there be a UI? Squad skills in SOS Squad Service could auto-sync to Mirror system messages.

4. **Multi-region?** For SaaS, EU customers will want EU-hosted. Hetzner has EU DCs, Cloudflare is inherently multi-region.
