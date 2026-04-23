# Mirror Token Issuance API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mirror's flat `tenant_keys.json` with a proper `mirror_tokens` PostgreSQL table and REST API so customers can self-serve workspace tokens.

**Architecture:** Three layers — a migration adds `mirror_workspaces` and `mirror_tokens` tables; `kernel/db.py` gets workspace/token CRUD methods; a new `plugins/admin/` plugin exposes REST endpoints under `/admin/`. The existing `kernel/auth.py` is updated to check the DB first with a fallback to `tenant_keys.json` for backward compat. All admin endpoints require the `MIRROR_ADMIN_TOKEN`.

**Tech Stack:** Python 3.11, FastAPI, psycopg2, `secrets` stdlib for token generation, pytest.

---

## Context for the implementer

**Current auth flow** (`mirror/kernel/auth.py`):
1. Empty token → 401
2. Matches `MIRROR_ADMIN_TOKEN` env var → admin
3. Hash found in `tenant_keys.json` → tenant token
4. SOS bus token check → SOS agent token
5. Unknown → 401

**What we're adding:**
- Step 2.5 between admin check and tenant_keys.json: check `mirror_tokens` table in PostgreSQL
- New admin REST endpoints for managing workspaces and tokens
- Backward compat: tenant_keys.json still works — existing agents don't break

**Token format:** `sk-{workspace_slug}-{16 hex bytes}` e.g. `sk-sos-dev-a3f9c2b1...`
Stored as `sha256(token)` — the plaintext is returned once on creation, never stored.

**Key files to understand before starting:**
- `mirror/kernel/auth.py` — current token resolution logic
- `mirror/kernel/db.py` — LocalDB class, `_ALLOWED_COLUMNS` frozenset, `_conn()` context manager pattern
- `mirror/plugins/memory/manifest.py` + `mirror/plugins/memory/routes.py` — plugin pattern to follow
- `mirror/mirror_api.py:130-136` — how plugins are registered

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `mirror/migrations/014_token_issuance.sql` | Create | `mirror_workspaces` and `mirror_tokens` tables |
| `mirror/kernel/db.py` | Modify | Add `create_workspace`, `list_workspaces`, `issue_token`, `list_tokens`, `revoke_token`, `resolve_token_from_db` |
| `mirror/kernel/auth.py` | Modify | Add DB lookup as step 2.5 in resolution chain |
| `mirror/plugins/admin/__init__.py` | Create | Empty |
| `mirror/plugins/admin/manifest.py` | Create | Plugin manifest — prefix `/admin` |
| `mirror/plugins/admin/routes.py` | Create | REST endpoints for workspace + token management |
| `mirror/mirror_api.py` | Modify | Register admin plugin |
| `mirror/tests/test_token_issuance.py` | Create | Tests for DB methods and auth resolution |

---

## Task 1: Migration — `mirror_workspaces` and `mirror_tokens` tables

**Files:**
- Create: `mirror/migrations/014_token_issuance.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Migration 014: Token issuance API
-- Replaces flat tenant_keys.json with a proper DB-backed token store.

CREATE TABLE IF NOT EXISTS mirror_workspaces (
    id          TEXT PRIMARY KEY,               -- e.g. "ws-a3f9c2b1"
    slug        TEXT NOT NULL UNIQUE,           -- e.g. "sos-dev"
    name        TEXT NOT NULL,                  -- display name
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mirror_tokens (
    id           TEXT PRIMARY KEY,              -- e.g. "tok-a3f9c2b1"
    workspace_id TEXT NOT NULL REFERENCES mirror_workspaces(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,          -- sha256(plaintext_token)
    label        TEXT NOT NULL,                 -- human name e.g. "kasra-agent"
    token_type   TEXT NOT NULL DEFAULT 'agent', -- agent | squad | readonly | admin
    owner_id     TEXT,                          -- agent/squad name within workspace
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mirror_tokens_workspace_idx
    ON mirror_tokens (workspace_id)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS mirror_tokens_hash_idx
    ON mirror_tokens (token_hash)
    WHERE active = true;
```

- [ ] **Step 2: Apply migration to production**

```bash
sudo -u postgres psql mirror -f /home/mumega/mirror/migrations/014_token_issuance.sql
```

Expected:
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
```

- [ ] **Step 3: Verify tables exist**

```bash
sudo -u postgres psql mirror -c "\dt mirror_workspaces mirror_tokens"
```

Expected: both tables listed.

- [ ] **Step 4: Commit**

```bash
cd /home/mumega/mirror
git add migrations/014_token_issuance.sql
git commit -m "feat(tokens): migration 014 — mirror_workspaces and mirror_tokens tables"
```

---

## Task 2: DB methods in `kernel/db.py`

**Files:**
- Modify: `mirror/kernel/db.py` — add 6 methods to `LocalDB` after `update_engram_quality`

- [ ] **Step 1: Write failing tests**

Create `mirror/tests/test_token_issuance.py`:

```python
"""Tests for token issuance DB methods and auth resolution."""
import hashlib
import os
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

os.environ["MIRROR_BACKEND"] = "local"
# Uses DATABASE_URL from environment (set in .env)

import pytest
from kernel.db import get_db


@pytest.fixture
def db():
    return get_db()


@pytest.fixture
def workspace(db):
    """Create a test workspace, yield it, then clean up."""
    ws = db.create_workspace(slug="test-ws-001", name="Test Workspace")
    yield ws
    # Cleanup — delete tokens first (FK), then workspace
    conn = db._conn().__enter__()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM mirror_tokens WHERE workspace_id = %s", [ws["id"]])
        cur.execute("DELETE FROM mirror_workspaces WHERE id = %s", [ws["id"]])
        conn.commit()
    finally:
        conn.close()


def test_create_workspace(db):
    ws = db.create_workspace(slug="test-ws-002", name="My Team")
    assert ws["id"].startswith("ws-")
    assert ws["slug"] == "test-ws-002"
    assert ws["name"] == "My Team"
    assert ws["active"] is True
    # Cleanup
    with db._conn() as conn:
        conn.cursor().execute("DELETE FROM mirror_workspaces WHERE id = %s", [ws["id"]])


def test_list_workspaces(db, workspace):
    workspaces = db.list_workspaces()
    ids = [w["id"] for w in workspaces]
    assert workspace["id"] in ids


def test_issue_token_returns_plaintext(db, workspace):
    result = db.issue_token(
        workspace_id=workspace["id"],
        label="test-agent",
        token_type="agent",
        owner_id="test-agent",
    )
    assert "token" in result        # plaintext returned once
    assert "token_id" in result
    assert result["token"].startswith("sk-")
    assert result["workspace_id"] == workspace["id"]


def test_issued_token_hash_stored(db, workspace):
    result = db.issue_token(
        workspace_id=workspace["id"],
        label="hash-check",
        token_type="agent",
        owner_id="test",
    )
    token_hash = hashlib.sha256(result["token"].encode()).hexdigest()
    resolved = db.resolve_token_from_db(token_hash)
    assert resolved is not None
    assert resolved["workspace_id"] == workspace["id"]


def test_list_tokens(db, workspace):
    db.issue_token(workspace_id=workspace["id"], label="tok-a", token_type="agent", owner_id="a")
    db.issue_token(workspace_id=workspace["id"], label="tok-b", token_type="readonly", owner_id=None)
    tokens = db.list_tokens(workspace["id"])
    assert len(tokens) >= 2
    labels = [t["label"] for t in tokens]
    assert "tok-a" in labels
    assert "tok-b" in labels


def test_revoke_token(db, workspace):
    result = db.issue_token(
        workspace_id=workspace["id"],
        label="revoke-me",
        token_type="agent",
        owner_id="test",
    )
    token_hash = hashlib.sha256(result["token"].encode()).hexdigest()
    db.revoke_token(result["token_id"])
    resolved = db.resolve_token_from_db(token_hash)
    assert resolved is None  # revoked tokens are not resolved


def test_resolve_token_from_db_unknown(db):
    assert db.resolve_token_from_db("notahash") is None


def test_resolve_token_from_db_sets_last_used(db, workspace):
    result = db.issue_token(
        workspace_id=workspace["id"],
        label="last-used",
        token_type="agent",
        owner_id="test",
    )
    token_hash = hashlib.sha256(result["token"].encode()).hexdigest()
    resolved = db.resolve_token_from_db(token_hash)
    assert resolved is not None
    # last_used_at should now be set
    with db._conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT last_used_at FROM mirror_tokens WHERE id = %s", [result["token_id"]])
            row = cur.fetchone()
    assert row[0] is not None
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/mumega/mirror && python3 -m pytest tests/test_token_issuance.py -q 2>&1 | head -15
```

Expected: `AttributeError: 'LocalDB' object has no attribute 'create_workspace'`

- [ ] **Step 3: Add 6 methods to `LocalDB` in `kernel/db.py`**

Find `update_engram_quality` (around line 490 after Task 1 of Dreamer plan) and add these methods directly after it, before `upsert_code_nodes`:

```python
    # ------------------------------------------------------------------
    # Token issuance API
    # ------------------------------------------------------------------

    def create_workspace(self, slug: str, name: str) -> dict:
        """Create a new workspace. Returns the workspace row."""
        import secrets as _secrets
        ws_id = f"ws-{_secrets.token_hex(4)}"
        with self._conn() as conn:
            with conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO mirror_workspaces (id, slug, name)
                    VALUES (%s, %s, %s)
                    RETURNING id, slug, name, active, created_at
                    """,
                    [ws_id, slug, name],
                )
                return dict(cur.fetchone())

    def list_workspaces(self) -> list[dict]:
        """Return all active workspaces."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, slug, name, active, created_at FROM mirror_workspaces WHERE active = true ORDER BY created_at DESC"
                )
                return [dict(r) for r in cur.fetchall()]

    def issue_token(
        self,
        workspace_id: str,
        label: str,
        token_type: str,
        owner_id: Optional[str],
    ) -> dict:
        """Issue a new token for a workspace.

        Returns dict with plaintext `token` (shown once), `token_id`, and `workspace_id`.
        Only the sha256 hash is stored — the plaintext is never persisted.
        """
        import secrets as _secrets
        import hashlib as _hashlib

        # Fetch workspace slug for the token prefix
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT slug FROM mirror_workspaces WHERE id = %s AND active = true", [workspace_id])
                row = cur.fetchone()
        if not row:
            raise ValueError(f"Workspace {workspace_id} not found or inactive")
        slug = row[0]

        plaintext = f"sk-{slug}-{_secrets.token_hex(16)}"
        token_hash = _hashlib.sha256(plaintext.encode()).hexdigest()
        tok_id = f"tok-{_secrets.token_hex(4)}"

        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO mirror_tokens (id, workspace_id, token_hash, label, token_type, owner_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [tok_id, workspace_id, token_hash, label, token_type, owner_id],
                )
        return {"token": plaintext, "token_id": tok_id, "workspace_id": workspace_id, "label": label}

    def list_tokens(self, workspace_id: str) -> list[dict]:
        """Return all active tokens for a workspace (hashes excluded)."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, workspace_id, label, token_type, owner_id, active, created_at, last_used_at
                    FROM mirror_tokens
                    WHERE workspace_id = %s AND active = true
                    ORDER BY created_at DESC
                    """,
                    [workspace_id],
                )
                return [dict(r) for r in cur.fetchall()]

    def revoke_token(self, token_id: str) -> None:
        """Soft-delete a token by setting active = false."""
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE mirror_tokens SET active = false WHERE id = %s",
                    [token_id],
                )

    def resolve_token_from_db(self, token_hash: str) -> Optional[dict]:
        """Look up a token by its sha256 hash. Updates last_used_at. Returns None if not found/inactive."""
        with self._conn() as conn:
            with conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT t.id, t.workspace_id, t.label, t.token_type, t.owner_id,
                           w.slug as workspace_slug
                    FROM mirror_tokens t
                    JOIN mirror_workspaces w ON w.id = t.workspace_id
                    WHERE t.token_hash = %s AND t.active = true AND w.active = true
                    """,
                    [token_hash],
                )
                row = cur.fetchone()
                if not row:
                    return None
                result = dict(row)
                # Update last_used_at in a separate statement
                cur.execute(
                    "UPDATE mirror_tokens SET last_used_at = NOW() WHERE id = %s",
                    [result["id"]],
                )
                return result
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
cd /home/mumega/mirror && python3 -m pytest tests/test_token_issuance.py -q
```

Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/mumega/mirror
git add kernel/db.py tests/test_token_issuance.py
git commit -m "feat(tokens): add workspace and token CRUD methods to LocalDB"
```

---

## Task 3: Admin plugin — REST endpoints

**Files:**
- Create: `mirror/plugins/admin/__init__.py`
- Create: `mirror/plugins/admin/routes.py`
- Create: `mirror/plugins/admin/manifest.py`

- [ ] **Step 1: Create `mirror/plugins/admin/__init__.py`**

```python
```

(empty file — Python package marker)

- [ ] **Step 2: Create `mirror/plugins/admin/routes.py`**

```python
"""
Admin plugin routes — workspace and token management.

All endpoints require the admin token (is_admin=True on TokenContext).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from kernel.auth import TokenContext, resolve_token_context
from kernel.db import get_db

logger = logging.getLogger("mirror.admin")

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(authorization: str = "") -> TokenContext:
    from fastapi import Header
    ctx = resolve_token_context(authorization)
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="Admin token required")
    return ctx


def _admin_ctx(authorization: str = Depends(lambda: "")) -> TokenContext:
    from fastapi import Header
    return _require_admin(authorization)


# Proper dependency that reads the Authorization header
from fastapi import Header as _Header


def _get_admin(authorization: str = _Header(default="")) -> TokenContext:
    return _require_admin(authorization)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateWorkspaceRequest(BaseModel):
    slug: str
    name: str


class IssueTokenRequest(BaseModel):
    label: str
    token_type: str = "agent"   # agent | squad | readonly | admin
    owner_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Workspace endpoints
# ---------------------------------------------------------------------------

@router.post("/workspaces")
def create_workspace(
    request: CreateWorkspaceRequest,
    ctx: TokenContext = Depends(_get_admin),
):
    """Create a new workspace."""
    try:
        db = get_db()
        if not hasattr(db, "create_workspace"):
            raise HTTPException(status_code=501, detail="Token DB not available on this backend")
        workspace = db.create_workspace(slug=request.slug, name=request.name)
        logger.info("Created workspace: %s (%s)", request.slug, workspace["id"])
        return workspace
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/workspaces")
def list_workspaces(ctx: TokenContext = Depends(_get_admin)):
    """List all active workspaces."""
    db = get_db()
    if not hasattr(db, "list_workspaces"):
        raise HTTPException(status_code=501, detail="Token DB not available on this backend")
    return {"workspaces": db.list_workspaces()}


# ---------------------------------------------------------------------------
# Token endpoints
# ---------------------------------------------------------------------------

@router.post("/workspaces/{workspace_id}/tokens")
def issue_token(
    workspace_id: str,
    request: IssueTokenRequest,
    ctx: TokenContext = Depends(_get_admin),
):
    """Issue a new token for a workspace. Returns plaintext token once — store it."""
    valid_types = {"agent", "squad", "readonly", "admin"}
    if request.token_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"token_type must be one of: {valid_types}")
    try:
        db = get_db()
        if not hasattr(db, "issue_token"):
            raise HTTPException(status_code=501, detail="Token DB not available on this backend")
        result = db.issue_token(
            workspace_id=workspace_id,
            label=request.label,
            token_type=request.token_type,
            owner_id=request.owner_id,
        )
        logger.info("Issued token %s for workspace %s", result["token_id"], workspace_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/workspaces/{workspace_id}/tokens")
def list_tokens(
    workspace_id: str,
    ctx: TokenContext = Depends(_get_admin),
):
    """List active tokens for a workspace (hashes not included)."""
    db = get_db()
    if not hasattr(db, "list_tokens"):
        raise HTTPException(status_code=501, detail="Token DB not available on this backend")
    return {"workspace_id": workspace_id, "tokens": db.list_tokens(workspace_id)}


@router.delete("/workspaces/{workspace_id}/tokens/{token_id}")
def revoke_token(
    workspace_id: str,
    token_id: str,
    ctx: TokenContext = Depends(_get_admin),
):
    """Revoke a token (soft delete — sets active=false)."""
    db = get_db()
    if not hasattr(db, "revoke_token"):
        raise HTTPException(status_code=501, detail="Token DB not available on this backend")
    db.revoke_token(token_id)
    logger.info("Revoked token %s from workspace %s", token_id, workspace_id)
    return {"status": "revoked", "token_id": token_id}
```

- [ ] **Step 3: Create `mirror/plugins/admin/manifest.py`**

```python
"""Admin plugin manifest — workspace and token management."""
from plugins.manifest import PluginManifest


def _make_router():
    from .routes import router
    return router


manifest = PluginManifest(
    name="admin",
    version="1.0.0",
    description="Workspace and token management for Mirror SaaS",
    routes_factory=_make_router,
)
```

- [ ] **Step 4: Register admin plugin in `mirror_api.py`**

Find this block in `mirror/mirror_api.py` (around line 132):
```python
from plugins.memory.manifest import manifest as memory_manifest
from plugins.mcp_server.manifest import manifest as mcp_server_manifest
plugin_loader.register(memory_manifest)
plugin_loader.register(mcp_server_manifest)
```

Add one import and one register call:
```python
from plugins.memory.manifest import manifest as memory_manifest
from plugins.mcp_server.manifest import manifest as mcp_server_manifest
from plugins.admin.manifest import manifest as admin_manifest
plugin_loader.register(memory_manifest)
plugin_loader.register(mcp_server_manifest)
plugin_loader.register(admin_manifest)
```

- [ ] **Step 5: Test endpoints manually**

Restart Mirror, then test:

```bash
systemctl --user restart mirror.service && sleep 3

# List workspaces (empty at first)
curl -s -H "Authorization: Bearer $(grep MIRROR_ADMIN_TOKEN /home/mumega/mirror/.env | cut -d= -f2)" \
  http://localhost:8844/admin/workspaces | python3 -m json.tool

# Create a workspace
curl -s -X POST http://localhost:8844/admin/workspaces \
  -H "Authorization: Bearer $(grep MIRROR_ADMIN_TOKEN /home/mumega/mirror/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"slug": "test-saas", "name": "Test SaaS Customer"}' | python3 -m json.tool

# Save the workspace id from above, then issue a token:
WS_ID="<id from above>"
curl -s -X POST "http://localhost:8844/admin/workspaces/${WS_ID}/tokens" \
  -H "Authorization: Bearer $(grep MIRROR_ADMIN_TOKEN /home/mumega/mirror/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"label": "test-agent", "token_type": "agent", "owner_id": "test"}' | python3 -m json.tool
```

Expected: workspace created, token returned with `sk-test-saas-...` prefix.

- [ ] **Step 6: Test issued token actually authenticates**

```bash
# Copy the token from the issue_token response above
TOKEN="sk-test-saas-..."

curl -s -X POST http://localhost:8844/search \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "top_k": 1}' | python3 -m json.tool
```

Expected: valid search response (not 401).

- [ ] **Step 7: Commit**

```bash
cd /home/mumega/mirror
git add plugins/admin/ mirror_api.py
git commit -m "feat(tokens): admin plugin — workspace and token REST endpoints"
```

---

## Task 4: Update `kernel/auth.py` — add DB lookup

**Files:**
- Modify: `mirror/kernel/auth.py`

Currently auth checks tenant_keys.json at step 3. We add a DB check at step 2.5.

- [ ] **Step 1: Update `resolve_token_context` in `kernel/auth.py`**

Find the comment `# 2. Tenant keys` and replace the entire block from that comment through the SOS check to add the DB step:

```python
    # 2. Admin
    if token == admin_token:
        return TokenContext(workspace_id=None, owner_type=None, owner_id=None, is_admin=True)

    key_hash = hashlib.sha256(token.encode()).hexdigest()

    # 2.5 DB-backed tokens (mirror_tokens table) — primary path for issued tokens
    try:
        from kernel.db import get_db as _get_db
        _db = _get_db()
        if hasattr(_db, "resolve_token_from_db"):
            row = _db.resolve_token_from_db(key_hash)
            if row:
                return TokenContext(
                    workspace_id=row["workspace_id"],
                    owner_type=row["token_type"],
                    owner_id=row.get("owner_id") or row.get("label"),
                    is_admin=row["token_type"] == "admin",
                )
    except Exception as _exc:
        logger.warning("DB token lookup failed: %s", _exc)

    # 3. Tenant keys (legacy — tenant_keys.json fallback)
    keys = _load_tenant_keys(tenant_keys_path)
    if key_hash in keys:
        entry = keys[key_hash]
        slug = entry["agent_slug"]
        workspace_id = entry.get("workspace_id") or slug
        return TokenContext(
            workspace_id=workspace_id,
            owner_type="agent",
            owner_id=slug,
            is_admin=False,
        )

    # 4. SOS bus tokens — primary path for all SOS agents
    try:
        import sys as _sys
        if '/home/mumega/SOS' not in _sys.path:
            _sys.path.insert(0, '/home/mumega/SOS')
        from sos.kernel.auth import verify_bearer as _sos_verify  # type: ignore[import]
        sos_ctx = _sos_verify(f"Bearer {token}")
        if sos_ctx is not None:
            owner_id = sos_ctx.agent or sos_ctx.project or "unknown"
            workspace_id = sos_ctx.project or "sos"
            return TokenContext(
                workspace_id=workspace_id,
                owner_type="agent",
                owner_id=owner_id,
                is_admin=getattr(sos_ctx, 'is_admin', False),
            )
    except ImportError:
        pass
    except Exception as exc:
        logger.warning("SOS auth check failed: %s", exc)

    raise HTTPException(status_code=401, detail="Invalid token")
```

- [ ] **Step 2: Smoke-test auth with an existing tenant_keys.json token**

```bash
# Get an existing token from tenant_keys.json
EXISTING_TOKEN=$(python3 -c "
import json
data = json.load(open('/home/mumega/mirror/tenant_keys.json'))
print(data[0]['key'])
")

curl -s -X POST http://localhost:8844/search \
  -H "Authorization: Bearer ${EXISTING_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "top_k": 1}' -w "\nHTTP %{http_code}\n"
```

Expected: `HTTP 200` — backward compat preserved.

- [ ] **Step 3: Run existing auth tests**

```bash
cd /home/mumega/mirror && python3 -m pytest tests/test_auth.py tests/test_workspace_isolation.py -q
```

Expected: all pass (no regressions).

- [ ] **Step 4: Commit**

```bash
cd /home/mumega/mirror
git add kernel/auth.py
git commit -m "feat(tokens): update auth to check DB tokens before tenant_keys.json"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `python3 -m pytest tests/test_token_issuance.py tests/test_auth.py tests/test_workspace_isolation.py -q` → all pass
- [ ] `POST /admin/workspaces` returns workspace with `ws-` prefixed id
- [ ] `POST /admin/workspaces/{id}/tokens` returns token with `sk-{slug}-` prefix
- [ ] Issued token authenticates on `POST /search` → 200, workspace-scoped results
- [ ] Existing `tenant_keys.json` tokens still work → 200
- [ ] `DELETE /admin/workspaces/{id}/tokens/{token_id}` → token 401s on next use
- [ ] Non-admin token on `/admin/*` → 403

---

## Notes for implementer

- **Token plaintext is returned once only** — the `issue_token` response is the only time the full `sk-...` string is available. It is never stored. If lost, revoke and re-issue.
- **`resolve_token_from_db` updates `last_used_at`** on every successful lookup — this is intentional for usage tracking (future billing hooks).
- **`hasattr` guards everywhere** — all DB method calls use `hasattr(db, "method")` so the admin plugin degrades gracefully on SQLite/SupabaseDB backends that don't implement these methods.
- **Backward compat is permanent** — do not remove the `tenant_keys.json` fallback until all agents have been migrated to DB tokens. That migration is a separate task.
