# Mirror → SOS Kernel Merge Plan

> **STATUS: COMPLETED — 2026-04-22**
> All phases shipped by Loom. SOS now imports `mirror.kernel.*` directly. HTTP :8844 preserved for external callers. Bus subscriber daemon built-in. Service self-registers with SOS Redis. See mirror CHANGELOG for full details.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Mirror's memory kernel into SOS as a first-class kernel module — eliminating all internal HTTP hops while keeping Mirror's HTTP API alive for external callers.

**Architecture:** Both SOS and Mirror are microkernels. Mirror's kernel (`db`, `embeddings`, `auth`) is pure Python — no HTTP needed internally. SOS currently calls Mirror over HTTP (`recall` → `http://localhost:8844/search`, bus consumer → `http://localhost:8844/store`). The merge makes SOS import Mirror's kernel directly, like a library module. Mirror's FastAPI service continues running for external callers (Inkwell, Claude Desktop MCP). No HTTP boundary inside the system.

**Tech Stack:** Python 3.11, FastAPI, PostgreSQL + pgvector, psycopg2, Redis Streams, systemd

---

## Before vs After

```
BEFORE:
  SOS remember → Redis stream → mirror_bus_consumer → HTTP :8844 → PostgreSQL
  SOS recall   → HTTP :8844  → PostgreSQL
  SOS MemoryCore → HTTP :8844 → PostgreSQL
  Inkwell → SOS bus → HTTP :8844 → PostgreSQL
  
AFTER:
  SOS remember → Redis stream → mirror_bus_consumer → mirror.kernel.db → PostgreSQL
  SOS recall   → mirror.kernel.db → PostgreSQL  (direct, no HTTP)
  SOS MemoryCore → mirror.kernel.db → PostgreSQL (direct, no HTTP)
  Inkwell → SOS bus → mirror.kernel.db → PostgreSQL
  Claude Desktop → Mirror HTTP :8844 → still works (external only)
```

---

## Ownership

- **Loom** — all tasks below (SOS + Mirror integration, one dev)
- **Athena** — review gate before each phase ships

---

## File Map

| File | Change |
|------|--------|
| `/home/mumega/SOS/sos/mcp/sos_mcp_sse.py` | Replace `recall` HTTP call with `mirror.kernel.db` direct import |
| `/home/mumega/SOS/sos/mcp/sos_mcp_sse.py` | Replace `remember` HTTP call (in stream consumer) with direct import |
| `/home/mumega/SOS/sos/services/memory/core.py` | Rewrite `MemoryCore` to import `mirror.kernel.*` instead of `MirrorClient` HTTP |
| `/home/mumega/SOS/scripts/mirror_bus_consumer.py` | Replace HTTP store call with `mirror.kernel.db.upsert_engram()` |
| `/home/mumega/mirror/kernel/auth.py` | Add SOS `verify_bearer` as primary auth path (before tenant_keys.json) |
| `/home/mumega/mirror/mirror_api.py` | Add lifespan: register with SOS via Redis discovery on startup |
| `/home/mumega/mirror/mirror_api.py` | Add lifespan: start bus subscriber as built-in background task |
| `/home/mumega/.config/systemd/user/mirror_bus_consumer.service` | Disable (replaced by Mirror built-in) |
| `/home/mumega/SOS/sos/kernel/settings.py` | Remove `MIRROR_URL` from kernel settings (no longer needed for internal use) |

---

## Phase 0 — Make Mirror a Python Package + Verify Import

> **Loom-confirmed blocker:** `/home/mumega/mirror` has no `__init__.py` — it is a directory, not a Python package. `from mirror.kernel import db` fails with `ModuleNotFoundError` until this is fixed. Do this before anything else.

### Task P0-1: Add `__init__.py` to make mirror a proper package

- [ ] **Step 1: Create the package init file**
  ```bash
  touch /home/mumega/mirror/__init__.py
  ```

- [ ] **Step 2: Verify mirror is now importable from SOS context**
  ```bash
  cd /home/mumega/SOS
  python3 -c "
  import sys
  sys.path.insert(0, '/home/mumega')
  from mirror.kernel.db import get_db
  from mirror.kernel.embeddings import get_embedding
  print('DB backend:', type(get_db()).__name__)
  print('Embedding dims:', len(get_embedding('test query')))
  print('Import OK')
  "
  ```
  Expected:
  ```
  DB backend: LocalDB
  Embedding dims: 1536
  Import OK
  ```

- [ ] **Step 3: Add `/home/mumega` to PYTHONPATH in all relevant SOS systemd units**
  ```bash
  # Edit each service that will import mirror.kernel:
  # - sos-mcp-sse.service
  # - mirror_bus_consumer.service (until it moves into Mirror)
  
  for unit in sos-mcp-sse; do
    UNIT_FILE="$HOME/.config/systemd/user/${unit}.service"
    # Add under [Service] if not already present:
    grep -q "PYTHONPATH" "$UNIT_FILE" || \
      sed -i '/^\[Service\]/a Environment=PYTHONPATH=/home/mumega' "$UNIT_FILE"
  done
  systemctl --user daemon-reload
  ```

- [ ] **Step 4: Commit**
  ```bash
  git -C /home/mumega/mirror add __init__.py
  git -C /home/mumega/mirror commit -m "chore: make mirror a proper Python package (add __init__.py)"
  ```

---

## Phase 1 — Unify Bus Consumer (remove HTTP from async write path)

**Goal:** `mirror_bus_consumer.py` stops calling Mirror's HTTP API and writes to PostgreSQL directly via `mirror.kernel.db`.

### Task P1-1: Rewrite mirror_bus_consumer

**File:** `/home/mumega/SOS/scripts/mirror_bus_consumer.py` (find exact path first)

- [ ] **Step 1: Find the consumer script**
  ```bash
  find /home/mumega/SOS -name "mirror_bus_consumer*" 2>/dev/null
  systemctl --user cat mirror_bus_consumer.service | grep ExecStart
  ```

- [ ] **Step 2: Read current consumer — identify the HTTP call**
  
  Look for the section that calls `http://localhost:8844/store`. It will look like:
  ```python
  requests.post(f"{mirror_url}/store", json=payload, headers=...)
  # or
  aiohttp.post(f"{mirror_url}/store", json=payload)
  ```

- [ ] **Step 3: Replace HTTP store with direct kernel call**
  
  Replace the HTTP call with:
  ```python
  import sys
  sys.path.insert(0, '/home/mumega/mirror')
  from mirror.kernel.db import get_db
  from mirror.kernel.embeddings import get_embedding
  
  _db = get_db()  # singleton — initialize once outside the loop
  
  # In the message handler loop, replace the HTTP call:
  def _store_engram(msg: dict) -> None:
      text = msg.get("text", "")
      embedding = get_embedding(text)
      _db.upsert_engram({
          "context_id": msg.get("context_id", msg.get("id", "")),
          "agent": msg.get("from", msg.get("agent", "bus")),
          "text": text,
          "embedding": embedding,
          "series": msg.get("agent", "bus"),
          "workspace_id": msg.get("project", "sos"),
          "owner_type": "agent",
          "owner_id": msg.get("from", "bus"),
          "metadata": msg,
      })
  ```

- [ ] **Step 4: Test by running consumer manually for 30 seconds**
  ```bash
  # Stop the service first
  systemctl --user stop mirror_bus_consumer.service
  
  # Run manually, send a test bus message, watch output
  python3 /path/to/mirror_bus_consumer.py &
  sleep 2
  # Send test message via bus
  python3 -c "
  import redis, json, time
  r = redis.Redis()
  r.xadd('sos:stream:global:agent:athena', {'type': 'send', 'text': 'test engram', 'from': 'athena', 'project': 'sos'})
  print('Sent test message')
  "
  sleep 3
  # Check it was stored
  curl -s -X POST http://localhost:8844/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -d '{"query": "test engram", "limit": 1}' | python3 -m json.tool
  ```
  Expected: result with similarity > 0.7

- [ ] **Step 5: Restart service**
  ```bash
  systemctl --user start mirror_bus_consumer.service
  systemctl --user status mirror_bus_consumer.service
  ```

- [ ] **Step 6: Commit**
  ```bash
  git -C /home/mumega/SOS add scripts/mirror_bus_consumer.py
  git -C /home/mumega/SOS commit -m "feat(memory): bus consumer writes to Mirror kernel directly, no HTTP"
  ```

---

## Phase 2 — Unify Recall (remove HTTP from synchronous read path)

**Goal:** The MCP SSE `recall` handler stops calling `http://localhost:8844/search` and reads from PostgreSQL directly.

### Task P2-1: Replace recall HTTP call in sos_mcp_sse.py

> **Loom-confirmed concern:** SOS MCP SSE is asyncio. Mirror's `psycopg2.pool.ThreadedConnectionPool` is synchronous. Calling sync DB directly from an async handler blocks the event loop. Fix: wrap all sync DB calls with `asyncio.get_event_loop().run_in_executor(None, ...)`.

**File:** `/home/mumega/SOS/sos/mcp/sos_mcp_sse.py` (lines ~1291-1309)

- [ ] **Step 1: Read the current recall handler**
  ```bash
  sed -n '1285,1315p' /home/mumega/SOS/sos/mcp/sos_mcp_sse.py
  ```
  
  Current code looks like:
  ```python
  mirror_url = settings.MIRROR_URL  # http://localhost:8844
  resp = await httpx.AsyncClient().post(
      f"{mirror_url}/search",
      json={"query": params["query"], "limit": params.get("limit", 10)},
      headers={"Authorization": f"Bearer {token}"},
  )
  results = resp.json()
  ```

- [ ] **Step 2: Add kernel imports at top of sos_mcp_sse.py**
  
  After existing imports, add:
  ```python
  # Mirror kernel — direct import, no HTTP
  import sys as _sys, asyncio as _asyncio, concurrent.futures as _futures
  _sys.path.insert(0, '/home/mumega')
  from mirror.kernel.db import get_db as _get_mirror_db
  from mirror.kernel.embeddings import get_embedding as _get_embedding

  _mirror_db = _get_mirror_db()   # singleton — connection pool
  _mirror_executor = _futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="mirror-db")
  ```

- [ ] **Step 3: Replace the recall handler body with async-safe wrapper**
  
  Replace the HTTP call block with:
  ```python
  # recall handler — sync DB called via executor to avoid blocking event loop
  query = params.get("query", "")
  limit = int(params.get("limit", 10))
  workspace_id = ctx.project  # from AuthContext

  loop = _asyncio.get_event_loop()

  # get_embedding may call Gemini API (network) — also run in executor
  embedding = await loop.run_in_executor(
      _mirror_executor, lambda: _get_embedding(query)
  )
  rows = await loop.run_in_executor(
      _mirror_executor,
      lambda: _mirror_db.search_engrams(
          embedding=embedding,
          threshold=0.5,
          limit=limit,
          project=workspace_id,
          workspace_id=workspace_id,
      )
  )
  results = [
      {"context_id": r["context_id"], "text": r["text"], "similarity": r.get("similarity", 0)}
      for r in rows
  ]
  return {"results": results}
  ```

- [ ] **Step 4: Test recall via MCP tool**
  ```bash
  # Store something first
  python3 -c "
  import sys; sys.path.insert(0, '/home/mumega/mirror')
  from mirror.kernel.db import get_db
  from mirror.kernel.embeddings import get_embedding
  db = get_db()
  db.upsert_engram({
      'context_id': 'test-recall-001',
      'agent': 'athena',
      'text': 'Mirror microkernel merge test engram',
      'embedding': get_embedding('Mirror microkernel merge test engram'),
      'series': 'athena',
      'workspace_id': 'sos',
      'owner_type': 'agent',
      'owner_id': 'athena',
      'metadata': {},
  })
  print('Stored OK')
  "
  
  # Recall via MCP SSE tool
  curl -s -X POST http://localhost:6070/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -d '{"method": "recall", "params": {"query": "Mirror microkernel", "limit": 3}}' \
    | python3 -m json.tool
  ```
  Expected: result contains "Mirror microkernel merge test engram" with similarity > 0.7

- [ ] **Step 5: Restart MCP SSE service**
  ```bash
  systemctl --user restart sos-mcp-sse.service
  systemctl --user status sos-mcp-sse.service
  ```

- [ ] **Step 6: Commit**
  ```bash
  git -C /home/mumega/SOS add sos/mcp/sos_mcp_sse.py
  git -C /home/mumega/SOS commit -m "feat(memory): recall reads from Mirror kernel directly, no HTTP"
  ```

---

## Phase 3 — Rewrite MemoryCore (remove MirrorClient HTTP wrapper)

**Goal:** `sos/services/memory/core.py` uses `mirror.kernel.*` directly instead of `MirrorClient` (which is just HTTP calls wrapped in Python).

### Task P3-1: Rewrite MemoryCore

> **Loom-confirmed concern:** MemoryCore is called from both sync and async contexts across SOS services. Rewrite provides both a sync interface (for services that aren't async) and async wrappers (for asyncio callers) using `run_in_executor`.

**File:** `/home/mumega/SOS/sos/services/memory/core.py`

- [ ] **Step 1: Read current MemoryCore**
  ```bash
  cat /home/mumega/SOS/sos/services/memory/core.py
  ```

- [ ] **Step 2: Rewrite with direct kernel imports + async-safe interface**
  
  Replace the entire file:
  ```python
  """MemoryCore — SOS memory backed by Mirror kernel. Sync + async interfaces."""
  from __future__ import annotations
  import sys, logging, asyncio, concurrent.futures
  sys.path.insert(0, '/home/mumega')

  from mirror.kernel.db import get_db
  from mirror.kernel.embeddings import get_embedding
  from dataclasses import dataclass

  log = logging.getLogger(__name__)
  _executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="memory-core")

  @dataclass
  class MemoryItem:
      id: str
      content: str
      metadata: dict
      score: float

  class MemoryCore:
      """SOS memory — Mirror kernel direct, no HTTP. Thread-safe sync + async."""

      def __init__(self, agent_name: str = "sos"):
          self.agent = agent_name
          self._db = get_db()
          log.info("MemoryCore: Mirror kernel loaded (direct, no HTTP)")

      # ── sync interface (for non-async callers) ──────────────────────────

      def add(self, content: str, metadata: dict | None = None) -> str:
          metadata = metadata or {}
          context_id = metadata.get("context_id", f"{self.agent}:{hash(content) & 0xFFFFFFFF}")
          embedding = get_embedding(content)
          self._db.upsert_engram({
              "context_id": context_id,
              "agent": self.agent,
              "text": content,
              "embedding": embedding,
              "series": self.agent,
              "workspace_id": metadata.get("project", "sos"),
              "owner_type": "agent",
              "owner_id": self.agent,
              "metadata": metadata,
          })
          return context_id

      def search(self, query: str, limit: int = 10, project: str | None = None) -> list[MemoryItem]:
          workspace_id = project or "sos"
          embedding = get_embedding(query)
          rows = self._db.search_engrams(embedding, 0.5, limit, project, workspace_id)
          return [MemoryItem(r.get("id",""), r.get("text",""), r.get("metadata") or {}, float(r.get("similarity",0))) for r in rows]

      def search_code(self, query: str, limit: int = 10, repo: str | None = None) -> list[MemoryItem]:
          embedding = get_embedding(query)
          rows = self._db.search_code_nodes(embedding, 0.5, limit, repo, None)
          return [MemoryItem(r.get("id",""), r.get("text",""), r or {}, float(r.get("similarity",0))) for r in rows]

      # ── async interface (for asyncio callers — run_in_executor to avoid blocking) ──

      async def async_add(self, content: str, metadata: dict | None = None) -> str:
          loop = asyncio.get_event_loop()
          return await loop.run_in_executor(_executor, lambda: self.add(content, metadata))

      async def async_search(self, query: str, limit: int = 10, project: str | None = None) -> list[MemoryItem]:
          loop = asyncio.get_event_loop()
          return await loop.run_in_executor(_executor, lambda: self.search(query, limit, project))

      async def async_search_code(self, query: str, limit: int = 10, repo: str | None = None) -> list[MemoryItem]:
          loop = asyncio.get_event_loop()
          return await loop.run_in_executor(_executor, lambda: self.search_code(query, limit, repo))
  ```

- [ ] **Step 3: Test MemoryCore directly**
  ```bash
  cd /home/mumega/SOS
  python3 -c "
  from sos.services.memory.core import MemoryCore
  m = MemoryCore('test')
  item_id = m.add('SOS microkernel test memory', {'project': 'sos'})
  print('Stored:', item_id)
  results = m.search('microkernel test')
  print('Found:', len(results), 'results')
  print('Top:', results[0].content if results else 'none')
  "
  ```
  Expected:
  ```
  MemoryCore: Mirror kernel loaded (direct, no HTTP)
  Stored: test:...
  Found: 1 results
  Top: SOS microkernel test memory
  ```

- [ ] **Step 4: Commit**
  ```bash
  git -C /home/mumega/SOS add sos/services/memory/core.py
  git -C /home/mumega/SOS commit -m "feat(memory): MemoryCore uses Mirror kernel directly, remove MirrorClient HTTP"
  ```

---

## Phase 4 — Unified Auth

**Goal:** Mirror accepts SOS bus tokens natively. SOS `verify_bearer` is the primary check in Mirror's auth cascade, before tenant_keys.json.

### Task P4-1: Unify Mirror auth with SOS kernel auth

**File:** `/home/mumega/mirror/kernel/auth.py`

- [ ] **Step 1: Read current resolve_token_context (lines 60-131)**
  ```bash
  sed -n '55,132p' /home/mumega/mirror/kernel/auth.py
  ```

- [ ] **Step 2: Add SOS auth as first check in cascade**
  
  Find the section after "check admin token" and before "check tenant_keys.json". Insert:
  ```python
  # SOS bus token check — primary path for all SOS agents
  try:
      import sys as _sys
      _sys.path.insert(0, '/home/mumega/SOS')
      from sos.kernel.auth import verify_bearer as _sos_verify
      sos_ctx = _sos_verify(f"Bearer {raw_token}")
      if sos_ctx is not None:
          return TokenContext(
              workspace_id=sos_ctx.project or "sos",
              owner_type="agent",
              owner_id=sos_ctx.agent or "unknown",
              is_admin=sos_ctx.is_admin,
          )
  except Exception:
      pass  # SOS not available — fall through to tenant_keys.json
  ```

- [ ] **Step 3: Test Athena's SOS token works in Mirror**
  ```bash
  # Athena's token: sk-bus-athena-08682825b90a738c77d3d00ef0211069
  curl -s http://localhost:8844/stats \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    | python3 -m json.tool
  ```
  Expected: stats response (not 401/403)

- [ ] **Step 4: Restart Mirror**
  ```bash
  systemctl --user restart mirror.service
  ```

- [ ] **Step 5: Commit**
  ```bash
  git -C /home/mumega/mirror add kernel/auth.py
  git -C /home/mumega/mirror commit -m "feat(auth): SOS bus tokens verified natively in Mirror auth cascade"
  ```

---

## Phase 5 — Mirror Self-Registers with SOS

**Goal:** Mirror registers itself with SOS service registry on startup. SOS health check includes Mirror.

### Task P5-1: Add SOS registration to Mirror startup

**File:** `/home/mumega/mirror/mirror_api.py`

- [ ] **Step 1: Add registration to lifespan or startup**
  
  After the existing startup code (around line 540, before `uvicorn.run`), add a background registration function:
  ```python
  import asyncio, threading
  
  def _register_with_sos():
      """Register Mirror with SOS service registry every 30s."""
      import sys as _sys
      _sys.path.insert(0, '/home/mumega/SOS')
      try:
          from sos.services.bus.discovery import register_service
          import asyncio as _asyncio
          loop = _asyncio.new_event_loop()
          while True:
              try:
                  loop.run_until_complete(register_service("mirror", 8844, {
                      "version": "2.0.0",
                      "kernel": "mirror",
                      "health": "http://localhost:8844/health",
                      "capabilities": ["remember", "recall", "search_code"],
                  }))
              except Exception:
                  pass
              import time; time.sleep(30)
      except ImportError:
          pass  # SOS not available — skip registration silently
  
  # Start registration thread before uvicorn
  threading.Thread(target=_register_with_sos, daemon=True).start()
  ```

- [ ] **Step 2: Verify Mirror appears in SOS peers after restart**
  ```bash
  systemctl --user restart mirror.service
  sleep 5
  # Check SOS registry
  python3 -c "
  import redis, json
  r = redis.Redis()
  keys = r.keys('sos:registry:service:*')
  for k in keys:
      print(k.decode(), json.loads(r.get(k) or '{}').get('name','?'))
  "
  ```
  Expected: `sos:registry:service:mirror  mirror` in output

- [ ] **Step 3: Commit**
  ```bash
  git -C /home/mumega/mirror add mirror_api.py
  git -C /home/mumega/mirror commit -m "feat(registry): Mirror self-registers with SOS on startup"
  ```

---

## Phase 6 — Move Bus Subscriber into Mirror (consolidate services)

**Goal:** `mirror_bus_consumer.service` is disabled. Mirror starts the subscriber as a built-in daemon thread on startup.

### Task P6-1: Built-in bus subscriber in Mirror

**File:** `/home/mumega/mirror/mirror_api.py`
**Create:** `/home/mumega/mirror/plugins/bus_subscriber/subscriber.py`

- [ ] **Step 1: Read the current consumer logic**
  ```bash
  cat $(systemctl --user cat mirror_bus_consumer.service | grep ExecStart | awk '{print $2}')
  ```

- [ ] **Step 2: Create subscriber module**
  ```python
  # /home/mumega/mirror/plugins/bus_subscriber/subscriber.py
  """Built-in bus subscriber — reads SOS Redis streams, stores engrams to Mirror kernel."""
  import os, json, logging, time
  import redis as _redis
  
  log = logging.getLogger(__name__)
  
  def run(db, get_embedding_fn):
      """Run subscriber loop. Call in a daemon thread."""
      r = _redis.Redis(
          host=os.getenv("REDIS_HOST", "localhost"),
          password=os.getenv("REDIS_PASSWORD", ""),
          decode_responses=True,
      )
      stream = "sos:stream:global:*"
      # Read all streams matching the pattern
      streams_to_watch = {}
      log.info("Mirror bus subscriber started")
  
      while True:
          try:
              # Discover active streams
              for key in r.scan_iter("sos:stream:*"):
                  if key not in streams_to_watch:
                      streams_to_watch[key] = "$"
  
              if not streams_to_watch:
                  time.sleep(2)
                  continue
  
              results = r.xread(streams_to_watch, block=2000, count=10)
              for stream_name, messages in (results or []):
                  for msg_id, fields in messages:
                      streams_to_watch[stream_name] = msg_id
                      _process(fields, db, get_embedding_fn)
          except Exception as e:
              log.error(f"Bus subscriber error: {e}")
              time.sleep(5)
  
  def _process(fields: dict, db, get_embedding_fn):
      text = fields.get("text", "")
      if not text:
          return
      try:
          embedding = get_embedding_fn(text)
          db.upsert_engram({
              "context_id": fields.get("id", f"bus:{hash(text) & 0xFFFFFFFF}"),
              "agent": fields.get("from", "bus"),
              "text": text,
              "embedding": embedding,
              "series": fields.get("from", "bus"),
              "workspace_id": fields.get("project", "sos"),
              "owner_type": "agent",
              "owner_id": fields.get("from", "bus"),
              "metadata": dict(fields),
          })
      except Exception as e:
          log.error(f"Failed to store engram: {e}")
  ```

- [ ] **Step 3: Start subscriber from Mirror startup**
  
  In `mirror_api.py`, after the registration thread, add:
  ```python
  from plugins.bus_subscriber.subscriber import run as _run_bus_subscriber
  _db_for_subscriber = get_db()
  threading.Thread(
      target=_run_bus_subscriber,
      args=(_db_for_subscriber, get_embedding),
      daemon=True,
      name="mirror-bus-subscriber",
  ).start()
  ```

- [ ] **Step 4: Test built-in subscriber is processing**
  ```bash
  systemctl --user restart mirror.service
  sleep 3
  journalctl --user -u mirror.service -n 20 | grep -i subscriber
  ```
  Expected: "Mirror bus subscriber started"

- [ ] **Step 5: Disable standalone consumer service**
  ```bash
  systemctl --user stop mirror_bus_consumer.service
  systemctl --user disable mirror_bus_consumer.service
  # Verify Mirror's built-in subscriber still running
  journalctl --user -u mirror.service -f &
  python3 -c "
  import redis, time
  r = redis.Redis(decode_responses=True)
  r.xadd('sos:stream:global:agent:athena', {'type': 'test', 'text': 'subscriber consolidation test', 'from': 'athena', 'project': 'sos'})
  print('Sent test message')
  "
  sleep 3
  # Check Mirror stored it
  curl -s -X POST http://localhost:8844/search \
    -H "Authorization: Bearer sk-bus-athena-08682825b90a738c77d3d00ef0211069" \
    -H "Content-Type: application/json" \
    -d '{"query": "subscriber consolidation test", "limit": 1}' | python3 -m json.tool
  ```
  Expected: result with similarity > 0.8

- [ ] **Step 6: Commit**
  ```bash
  git -C /home/mumega/mirror add plugins/bus_subscriber/ mirror_api.py
  git -C /home/mumega/mirror commit -m "feat(bus): built-in bus subscriber, disable standalone mirror_bus_consumer service"
  ```

---

## Phase 7 — Cleanup

### Task P7-1: Remove MIRROR_URL from internal SOS settings

Once phases 1-6 are complete and stable (1 week), `MIRROR_URL` is only used for external compatibility checks. Document it clearly.

- [ ] **Step 1: Audit remaining MIRROR_URL references**
  ```bash
  grep -r "MIRROR_URL\|localhost:8844\|mirror_url" /home/mumega/SOS/sos/ --include="*.py" -n
  ```

- [ ] **Step 2: For each remaining reference, determine if it's internal (remove) or external-compatibility (keep with comment)**

- [ ] **Step 3: Add comment in kernel/settings.py**
  ```python
  # MIRROR_URL: kept for external compatibility only (Inkwell, health checks)
  # Internal SOS components use mirror.kernel.* directly
  MIRROR_URL: str = os.getenv("MIRROR_URL", "http://localhost:8844")
  ```

- [ ] **Step 4: Remove SOS memory service proxy (port 6061) if no external callers remain**
  ```bash
  # Check if anything external calls :6061
  grep -r "6061\|sos/services/memory" /home/mumega/SOS/ -n | grep -v "core.py\|__pycache__"
  # If no external callers: disable the service
  systemctl --user stop sos-memory.service 2>/dev/null || true
  ```

- [ ] **Step 5: Final integration test**
  ```bash
  # Full pipeline test: remember → store → recall
  python3 -c "
  import sys; sys.path.insert(0, '/home/mumega/mirror')
  from sos.kernel.auth import verify_bearer
  from mirror.kernel.db import get_db
  from mirror.kernel.embeddings import get_embedding
  
  # Direct kernel test
  db = get_db()
  emb = get_embedding('final integration test phrase')
  db.upsert_engram({
      'context_id': 'integration-test-final',
      'agent': 'athena',
      'text': 'final integration test phrase',
      'embedding': emb,
      'series': 'athena',
      'workspace_id': 'sos',
      'owner_type': 'agent',
      'owner_id': 'athena',
      'metadata': {},
  })
  results = db.search_engrams(emb, 0.8, 1, None, 'sos')
  assert results, 'No results found!'
  assert results[0]['text'] == 'final integration test phrase'
  print('All integration tests passed.')
  "
  ```

- [ ] **Step 6: Final commit**
  ```bash
  git -C /home/mumega/SOS add -A
  git -C /home/mumega/SOS commit -m "chore(memory): cleanup after Mirror kernel merge — remove unused HTTP references"
  ```

---

## Rollback Plan

If any phase causes issues:

```bash
# Revert recall to HTTP
git -C /home/mumega/SOS revert HEAD  # undoes sos_mcp_sse.py change

# Restart bus consumer standalone
systemctl --user start mirror_bus_consumer.service

# Verify Mirror HTTP is still running (it never stopped)
curl -s http://localhost:8844/health
```

Mirror's HTTP API is never removed — it stays running throughout. Rollback is always possible.

---

## Success Criteria

- [ ] `recall` via MCP SSE returns correct results with no HTTP calls to :8844
- [ ] Bus consumer stores engrams without HTTP calls to :8844  
- [ ] `MemoryCore.add()` and `MemoryCore.search()` work without HTTP
- [ ] SOS bus tokens (`sk-bus-*`) work directly in Mirror HTTP API
- [ ] Mirror appears in SOS peer discovery (`redis-cli KEYS "sos:registry:service:*"`)
- [ ] `mirror_bus_consumer.service` disabled, subscriber runs inside Mirror process
- [ ] Mirror HTTP API (:8844) still responds for external callers
- [ ] All existing agent workflows (Kasra, Loom, Mumega) unaffected

---

## Summary: What Changes

| Component | Before | After |
|-----------|--------|-------|
| `recall` handler | HTTP POST to :8844 | Direct `mirror.kernel.db.search_engrams()` |
| Bus consumer write | HTTP POST to :8844 | Direct `mirror.kernel.db.upsert_engram()` |
| `MemoryCore` | `MirrorClient` HTTP wrapper | `mirror.kernel.*` direct imports |
| Mirror auth | tenant_keys.json first | SOS `verify_bearer` first, tenant_keys.json fallback |
| Mirror registration | None | Self-registers with SOS every 30s |
| Bus subscriber | Standalone systemd service | Built-in Mirror daemon thread |
| Mirror HTTP :8844 | External + internal | External only (Inkwell, Claude Desktop) |
| Systemd services | mirror + mirror_bus_consumer | mirror only |

**One HTTP service less. Two fewer network hops per operation. One auth system. One process to restart.**
