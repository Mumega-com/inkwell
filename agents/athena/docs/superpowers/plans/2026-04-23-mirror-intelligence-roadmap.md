# Mirror Intelligence Roadmap — Memory Quality & Dreaming

**Owner:** Athena (PM) · Loom (implementation)
**Status:** Planning — 2026-04-23
**Goal:** Make Mirror's 22k+ engrams useful, not just stored. From raw storage to reasoning substrate.

---

## Background

Mirror has strong infrastructure (hybrid BM25+vector search, RRF, halfvec, workspace isolation, SOS bus integration) but no memory quality layer. 22k engrams exist — most are never retrieved, many are redundant, none decay or age. This roadmap adds intelligence to what we store.

Research basis: surveyed openclaw-auto-dream, Graphiti (Zep), YantrikDB, SimpleMem, CortexGraph, ReMe. See Mirror CHANGELOG 2026-04-22 for current state.

---

## What SOTA does that Mirror doesn't

| Capability | Best implementation | Mirror today |
|---|---|---|
| Nightly dreaming / consolidation | openclaw-auto-dream | ❌ |
| Temporal validity windows on facts | Graphiti (getzep/graphiti) | ❌ |
| Contradiction flagging | YantrikDB | ❌ |
| Per-engram decay curves | YantrikDB (`half_life` per engram) | ❌ |
| Online dedup at write time | SimpleMem | ❌ |
| Surprisal / information density scoring | — (mostly theoretical) | ❌ |
| Archive instead of delete | openclaw-auto-dream | ❌ |

---

## Phase 1 — Online Consolidation at Write Time (SimpleMem pattern)

**Why first:** Every engram that arrives is already partially redundant. Deduping at write costs nothing extra vs deduping later in batch.

**What it does:** Before storing a new engram, check for semantically similar existing engrams (cosine > 0.92). If found: merge text fragments, update timestamp, boost importance score. Do not create a new row.

**Implementation:**
- In `plugins/memory/routes.py` `/store` handler, before `db.upsert_engram()`:
  ```python
  near = db.search_engrams(embedding, threshold=0.92, limit=1, workspace_id=workspace_id)
  if near:
      db.merge_engram(near[0]['id'], new_text, new_metadata)
      return  # skip insert
  ```
- `merge_engram()` in `kernel/db.py`: append text fragment, increment `reference_count`, update `timestamp`
- Add `reference_count INT DEFAULT 1` to `mirror_engrams` (migration 012)

**Outcome:** Write amplification drops. High-frequency repeated context accumulates into single dense engrams rather than thousands of near-duplicates.

---

## Phase 2 — Dreamer Agent (Nightly Consolidation Cycle)

**Reference:** [LeoYeAI/openclaw-auto-dream](https://github.com/LeoYeAI/openclaw-auto-dream)

**What it does:** A background agent (systemd timer, nightly at 03:30 UTC after backup) processes recent engrams:

1. **Collect** — scan engrams from last 7 days with `importance > 0.3` or `reference_count > 2`
2. **Score** — `importance_score = (base_weight × recency_factor × reference_count) / 8.0`
   - `recency_factor = 1.0 / (1 + days_old × 0.1)` — linear decay
   - `base_weight` from engram metadata (default 1.0, pinned = 5.0)
3. **Tier promotion** — engrams score above threshold get `memory_tier` upgraded:
   - `working` (< 24h, any score) → `episodic` (score > 0.4) → `long_term` (score > 0.7, age > 7d) → `procedural` (patterns, score > 0.8)
4. **Archive low-value** — engrams below `0.1` score + older than 90 days: set `archived=true`. Never delete.

**Schema additions (migration 013):**
```sql
ALTER TABLE mirror_engrams ADD COLUMN memory_tier TEXT DEFAULT 'working';
ALTER TABLE mirror_engrams ADD COLUMN importance_score FLOAT DEFAULT 1.0;
ALTER TABLE mirror_engrams ADD COLUMN reference_count INT DEFAULT 1;
ALTER TABLE mirror_engrams ADD COLUMN archived BOOLEAN DEFAULT false;
```

**Dreamer as SOS bus agent:**
```
sos:stream:project:sos:agent:dreamer
```
Runs as lightweight Python script triggered by systemd timer. Sends summary to Mirror's own engram store on completion ("Dreamed 1,842 engrams: promoted 127 to long_term, archived 63").

---

## Phase 3 — Temporal Validity Windows

**Reference:** [getzep/graphiti](https://github.com/getzep/graphiti)

**Problem:** "Kasra is using Python for all backends" was true in April. In June it may be false. Today Mirror has no way to invalidate a fact — it just sits there, potentially contradicting newer engrams.

**What it does:** Facts get a `valid_until` timestamp. When a new engram is stored that contradicts an existing one (cosine > 0.85 but semantic contradiction detected), the old engram gets `valid_until = now()`. It remains queryable by history search but excluded from default recall.

**Implementation:**
- Add `valid_until TIMESTAMP` to `mirror_engrams` (NULL = still valid)
- `mirror_match_engrams_v2` gains an additional filter: `AND (valid_until IS NULL OR valid_until > NOW())`
- Contradiction detection: compare incoming embedding against top-5 similar engrams; if similarity > 0.85, flag for validation check
- Validation check: LLM call (cheap model) or heuristic (same `context_id` + similar embedding = likely update)

**History mode:** `/search?include_expired=true` returns all engrams including invalidated ones. Full provenance always queryable.

---

## Phase 4 — Contradiction Flagging

**Reference:** [YantrikDB](https://github.com/yantrikos/yantrikdb-server)

Rather than algorithmically resolving contradictions (brittle), surface them for the agent to decide.

**What it does:** When Phase 3 detects a potential contradiction, instead of auto-invalidating:
1. Store both engrams
2. Tag both with `contradiction_group = UUID`
3. Add to a `mirror_contradictions` table with both engram IDs + similarity score
4. Surface via `/contradictions` endpoint
5. Agents (or Dreamer) can resolve: `POST /contradictions/{id}/resolve` with `keep_id`

**Dreamer integration:** During nightly cycle, Dreamer reviews unresolved contradictions older than 7 days and resolves them using recency (newer wins unless `importance` says otherwise).

---

## Phase 5 — Surprisal Scoring

**Goal:** Rank engrams by information density. An engram that says something unique scores higher than one that repeats what many others already say.

**Algorithm:**
```
surprisal = -log2(max_similarity_to_any_other_engram)
```
High surprisal = novel information. Low surprisal = redundant (candidate for archiving).

**Integration:** Added as a column populated by Dreamer during nightly cycle. Used by `/search` to boost novel results over redundant ones.

---

## Backlog Integration

Maps to existing Mirror backlog items:

| Backlog ID | Phase |
|---|---|
| mirror-three-source-blending | Phase 1 + Phase 2 (importance scoring) |
| mirror-temporal-entity-layer | Phase 3 + Phase 4 |
| mirror-sensitivity-forgetting | Phase 2 (forgetting curves) |
| mirror-surprisal-metric | Phase 5 |
| mirror-dreamer-specialists | Phase 2 + Phase 4 |
| mirror-search-first-retrieval | Phase 3 (history mode) |

---

## Priority

| Phase | Effort | Value | Priority |
|---|---|---|---|
| 1 — Online dedup | Low (1 migration + route change) | High (immediate storage quality) | **Start here** |
| 2 — Dreamer agent | Medium (new service) | High (processes existing 22k engrams) | **Sprint 4** |
| 3 — Temporal validity | Medium (migration + query change) | High (prevents stale facts) | Sprint 5 |
| 4 — Contradiction flagging | Medium | Medium | Sprint 6 |
| 5 — Surprisal | Low (Dreamer extension) | Medium | Sprint 6 |
