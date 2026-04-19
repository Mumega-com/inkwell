# Port Registry Handoff — v0.9.0

**From:** codex (SOS side)
**To:** kasra (Inkwell side)
**Date:** 2026-04-18
**Context:** Phase 1 of the Mumega Mothership plan. Python and TypeScript
now share a single canonical port registry — SOS is the source of truth,
TS is generated from its JSON Schemas.

---

## What landed

1. **13 Python `Protocol` ports** in SOS: `/mnt/HC_Volume_104325311/SOS/sos/contracts/ports/`
2. **75 Pydantic v2 request/response models** (one schema file per model)
3. **75 generated `.ts` modules + `index.ts` barrel** here in Inkwell:
   `/home/mumega/inkwell/kernel/ports/generated/`
4. **Pipeline**: `make contracts` in SOS repo → exports JSON Schemas →
   runs `json-schema-to-typescript` → writes into this repo.
5. **Drift guard**: `pytest tests/contracts/test_port_schemas_export.py`
   + `make contracts-check` (CI-ready).

---

## Your step 1.4

Swap `kernel/types.ts` port interfaces to re-export from the generated
modules. You don't have to reshape the interfaces — the generator emits
them with the names you already use. What to do:

1. Delete the hand-written `BusPort`, `EconomyPort`, `MemoryPort`,
   `StoragePort`, `DatabasePort`, `SessionPort`, `AuthPort`, `AgentPort`,
   `ContentSourcePort`, `CRMPort`, `SearchPort`, `GraphPort`, `ContentPort`
   interface blocks from `kernel/types.ts`.
2. Replace with `export * from "./ports/generated"` (or targeted
   re-exports if you want the barrel narrower).
3. Wire the generated types into `kernel/adapter-registry.ts` so adapter
   implementations have to satisfy them at compile time.
4. Run `cd kernel && npx vitest run` — plugin typings may need nudging
   at call sites, that's the point of step 1.4.

The barrel is at: `/home/mumega/inkwell/kernel/ports/generated/index.ts`

---

## Divergences from Inkwell v7.0 (acknowledged, need your read)

These were deliberate calls on the SOS side. If any break Inkwell's
plugin contracts, flag them back and we'll revise.

### 1. `BusMessage` gained optional `project: string | null`
- **Why:** Phase 2 (v0.9.1) makes `project` required for tenant-scope
  bus routing. Landing it as optional in v0.9.0 keeps the schema stable
  across the bump.
- **Action for Inkwell:** plugins emitting bus messages should start
  passing `project` now; it's a no-op today and load-bearing in v0.9.1.

### 2. `SubscribeHandle` → `UnsubscribeHandle` callable
- **Why:** the old `{ unsubscribe: Any }` Pydantic model serialized a
  callable as `unknown` — no useful wire shape.
- **Now:** `UnsubscribeHandle = () => Promise<void>` on both sides.
  `BusPort.subscribe(cb): Promise<UnsubscribeHandle>`.
- **Action:** check your bus adapter's `subscribe()` return — should
  already match since Inkwell typed it this way.

### 3. `SearchPort.delete(docId)` added
- Not in Inkwell v7. SOS needs it for the mirror-backed curator path.
- **Action:** add `delete` to Inkwell's `SearchPort`, or mark this
  as SOS-extended and noop on Inkwell adapters.

### 4. `CRMPort` is wider than Inkwell v6
- Added list/update/custom-field ops. All tenant-scoped.
- **Action:** adopt wholesale or pare back — your call.

### 5. `ContentPort`: `key` → `path`, no `listPages()`, added `invalidate()`
- **Why:** `path` is the natural primary key for markdown trees;
  `listPages` was caller-specific and lives in CMS code, not the port;
  `invalidate` is needed for the Glass (Phase 6) cache bust.
- **Action:** anywhere Inkwell called `listPages()` needs a shim —
  implement it in the CMS plugin, not the port.

### 6. `AgentPort.provision` uses a `ProvisionRequest` model
- Inkwell's `Omit<AgentConfig, 'status' | 'createdAt' | 'updatedAt'>`
  can stay — the generated TS will land as `ProvisionRequest` but the
  fields are equivalent. Adjust the adapter signature in step 1.4.

### 7. Graph/Storage/Memory shape notes
- `StoragePort.get` returns `bytes` (Python) → `Uint8Array` (TS), not a
  stream.
- `MemoryPort` uses `MemoryResult` instead of Inkwell's inline type.
- `GraphPort` omits `ingest()` and `queryNetwork()` — not needed yet.

### 8. MediaPort added (Inkwell v7.1 parity — 14th port)
- **Why:** Inkwell v7.1 shipped MediaPort
  (`/home/mumega/inkwell/kernel/types.ts:380-430`). SOS now mirrors it
  as the 14th canonical port so step 1.4 can `export * from
  "./generated"` without a hole.
- **Port file:** `sos/contracts/ports/media.py` — 1 port, 12 models
  (`MediaChapter`, `MediaAsset`, plus request/response pairs for
  `upload`, `get`, `describe`, `transcribe`, `transform`, `search`,
  `list`, `delete`, `generateImage`).
- **Method surface:** 9 async methods matching Inkwell's interface.
  Note one naming divergence: Python `generate_image()` ↔ TS
  `generateImage()` (snake_case vs camelCase — language idiom, same
  contract). Adapter wrappers bridge the names.
- **Tenant binding:** EXPLICIT — `MediaAsset.tenant: Optional[str]` +
  `tenant` field on `MediaUploadRequest`, `MediaSearchRequest`,
  `MediaListRequest`, `MediaGenerateImageRequest`. Adapter enforces
  access checks at call time.
- **Generated TS:** 12 new modules in `kernel/ports/generated/`
  (`media_*.ts`). Barrel updated (87 exports total).
- **Action for Inkwell:** include `MediaPort` in the interface block
  you re-export from step 1.4. Adapter file stays where it is —
  nothing moves.

---

## Commands you'll want

```bash
# In SOS repo — regenerate TS after a Pydantic change
cd /mnt/HC_Volume_104325311/SOS
make contracts                  # regen both sides
make contracts-check            # CI mode — fails on drift

# In Inkwell repo — regen TS only (same script, different cwd)
cd /home/mumega/inkwell
npm run gen:types

# Tests
cd /mnt/HC_Volume_104325311/SOS && pytest tests/contracts/
cd /home/mumega/inkwell/kernel && npx vitest run
```

---

## Source of truth

**Never** hand-edit `kernel/ports/generated/*.ts` — the file header says
so and a re-run of the script wipes any edits.

If you need a shape changed:
1. Edit the Pydantic model in `sos/contracts/ports/<port>.py`.
2. Run `make contracts` in SOS.
3. Both sides update atomically; commit both repos.

For shapes Inkwell needs that SOS doesn't (UI-only), keep them in a
separate `kernel/ports/extensions/` you own — don't merge into the
generated barrel.

---

## Ping me back

When you've scanned this, reply on the bus (`kasra → codex`) with
"seen, starting step 1.4" or flag any divergence that breaks your
adapter work. Phase 2 (bus stability: project-scope + ack-or-retry) is
next — until it ships, this handoff doc is how we stay in sync.

— codex
