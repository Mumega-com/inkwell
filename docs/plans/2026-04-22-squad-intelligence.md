# Squad Intelligence — Memory, KPIs, and League
**Date:** 2026-04-22  
**Approach:** Option C — phased WoW system, right infrastructure, right scope  
**Branches:** SOS (Python) + Inkwell (Cloudflare Worker + Astro)

---

## Vision

Squads behave like WoW guilds:
- **Memory** — shared context all members read/write, like a guild bank notes or group chat history
- **KPIs** — live performance metrics (velocity, success rate, bounty earnings, agent utilization)
- **League** — monthly seasons with tier rankings: Nomad → Fortress → Construct
- **Brain** — squad tier feeds back into task scoring (top-tier squads get harder/higher-value tasks)

---

## Architecture Decisions

| Concern | Decision | Reason |
|---------|----------|--------|
| Squad memory storage | Mirror `project=squad:{id}` convention | Zero schema change, vector search already works |
| KPI storage | Extend existing `diagnostics_snapshots` D1 table | Already captures daily squad metrics |
| League tables | New `league_seasons` + `league_scores` tables in Squad service DB | Clean separation from operational data |
| Tier promotion | Weekly cron in Squad service | Keeps scoring logic co-located with squad data |
| Brain integration | Squad tier multiplier in `scoring.py` | Minimal change, high leverage |

---

## Phase 1 — Squad Memory (SOS + Inkwell)

### Step 1: Add `squad_remember` + `squad_recall` MCP tools
```
File: /home/mumega/SOS/sos/mcp/sos_mcp_sse.py
Change: Register two new tools:
  - squad_remember(squad_id, text, agent_id?) → POST to Mirror /store
    with project="squad:{squad_id}", series="squad:{squad_id}"
  - squad_recall(squad_id, query, limit=10) → POST to Mirror /search
    with project="squad:{squad_id}"
Outcome: Any agent can call mcp__sos__squad_remember / squad_recall
```

### Step 2: Add memory endpoints to Squad service
```
File: /home/mumega/SOS/sos/services/squad/app.py
Change: Two new routes:
  POST /squads/{id}/memory  body:{text, agent_id} → proxy to Mirror /store
  GET  /squads/{id}/memory?q=&limit=  → proxy to Mirror /search
Outcome: curl POST /squads/seo/memory stores squad-scoped engram in Mirror
```

### Step 3: Auto-write squad memory on task complete
```
File: /home/mumega/SOS/sos/services/squad/service.py
Change: In complete_task(), after marking done, call Mirror /store with:
  project="squad:{squad_id}", text=f"Task '{title}' done: {result_json summary}"
  series="system", context_id=f"task:{task_id}:done"
Outcome: Completed tasks automatically appear in squad memory timeline
```

### Step 4: SquadMemoryPanel React component
```
File: /home/mumega/mumega.com/plugins/dashboard/components/SquadMemoryPanel.tsx
Change: New component. Calls GET /api/squads/{id}/memory?q=&limit=20
  - Timeline of recent memories (newest first), each card shows: text, agent, timestamp
  - Search bar triggers recall query
  - "Add note" button → POST /api/squads/{id}/memory (manager+ role)
Outcome: Squad members can read shared context and search past decisions
```

### Step 5: Inkwell proxy routes for squad memory
```
File: /home/mumega/mumega.com/workers/inkwell-api/src/routes/dashboard.ts
Change: Add:
  GET  /api/squads/:id/memory?q= → proxy to SOS Squad service
  POST /api/squads/:id/memory    → proxy to SOS Squad service (auth required)
Outcome: Dashboard can call squad memory API via Worker
```

### Step 6: Wire SquadMemoryPanel into squads page
```
File: /home/mumega/mumega.com/src/pages/dashboard/squads.astro
Change: Import SquadMemoryPanel, render below existing SquadPanel with client:load
Outcome: /dashboard/squads shows squad cards + memory timeline per squad
```

---

## Phase 2 — Squad KPIs

KPI formula (weighted score 0–100):
```
velocity      = tasks_done_7d / 7              × 20 pts  (tasks per day)
success_rate  = done / (done + failed)          × 20 pts
bounty_score  = bounties_claimed × avg_reward   × 15 pts  (normalized)
wallet_growth = (balance - balance_7d_ago) / balance_7d_ago × 15 pts
utilization   = assigned_tasks / member_count   × 15 pts
token_score   = tokens_used (display only, no weight — tokens are a cost)
money_earned  = total_earned_cents (display, feeds wallet_growth)

kpi_score = sum of weighted pts, clamped 0–100
```

**Token usage** source: `squad_wallets.fuel_budget_json` (tracks diesel|regular|premium|aviation spend)
+ sum of `squad_tasks.token_budget` for completed tasks in the window.
Displayed as: total tokens used this period, broken down by fuel grade (cheap → expensive).

**Money earned** source: `squad_wallets.total_earned_cents` — sum of all `squad_transactions` where
`type='earn'` for the squad. Displayed as total lifetime earnings + this month's earnings.

### Step 7: Extend diagnostics_snapshots D1 schema
```
File: /home/mumega/mumega.com/workers/inkwell-api/migrations/core/0019_squad_kpis.sql
Change: ALTER TABLE diagnostics_snapshots ADD COLUMN wallet_balance_cents INTEGER DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN total_earned_cents INTEGER DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN tokens_used INTEGER DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN tokens_by_grade TEXT DEFAULT '{}';
        ALTER TABLE diagnostics_snapshots ADD COLUMN bounties_claimed INTEGER DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN kpi_score REAL DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN velocity REAL DEFAULT 0;
        ALTER TABLE diagnostics_snapshots ADD COLUMN success_rate REAL DEFAULT 0;
Outcome: KPI fields available for trending and league scoring, including token + money data
```

### Step 8: KPI calculation in Squad service
```
File: /home/mumega/SOS/sos/services/squad/service.py
Change: New method calculate_kpis(squad_id) → KPISnapshot dataclass
  Queries: task counts (7d window), wallet balance, member count, bounties from Inkwell
  Returns: velocity, success_rate, bounty_score, wallet_growth, utilization, kpi_score
Outcome: GET /squads/{id}/kpis returns live KPI scores
```

### Step 9: Add GET /squads/{id}/kpis endpoint
```
File: /home/mumega/SOS/sos/services/squad/app.py
Change: GET /squads/{id}/kpis → calls calculate_kpis() + returns KPISnapshot
        GET /squads/{id}/kpis/history?days=30 → reads diagnostics_snapshots
Outcome: curl /squads/seo/kpis returns {"velocity":3.2,"success_rate":0.91,"kpi_score":78}
```

### Step 10: Daily KPI snapshot cron
```
File: /home/mumega/SOS/sos/services/squad/app.py (or a scheduler file)
Change: Add APScheduler job (daily at 00:05 UTC): for each active squad,
  calculate_kpis() → write to diagnostics_snapshots via Inkwell Worker API
Outcome: KPI history accumulates daily for trending + league scoring
```

### Step 11: Brain reads squad KPI tier
```
File: /home/mumega/SOS/sos/services/brain/scoring.py
Change: In score_task(), fetch squad tier from Squad service (cached, TTL 5min):
  tier_multiplier = {"construct": 1.4, "fortress": 1.1, "nomad": 1.0}
  final_score = base_score × tier_multiplier[squad.tier]
Outcome: Construct-tier squads surface harder/higher-value tasks first
```

### Step 12: Update SquadPanel to show KPI gauges
```
File: /home/mumega/mumega.com/plugins/dashboard/components/SquadPanel.tsx
Change: Call GET /api/squads/{id}/kpis alongside existing /my/squads
  Add KPI row per squad card: velocity bar, success rate bar, kpi_score badge
  Color coding: ≥80 gold, 50–79 cyan, <50 muted
Outcome: Squad cards show live performance at a glance
```

---

## Phase 3 — Squad League

The WoW ranking:
```
Construct ████████  Top 15% by kpi_score  — Mythic+ raiders
Fortress  ██████    Mid 35% by kpi_score  — Heroic progression
Nomad     ████      Bottom 50%            — Normal / leveling
```

Seasons reset monthly. Score = kpi_score averaged over the season window.

### Step 13: League tables in Squad service DB
```
File: /home/mumega/SOS/sos/services/squad/models.py
Change: Add two new SQLAlchemy models:
  LeagueSeason: id, name, start_date, end_date, status(active|completed), tenant_id
  LeagueScore:  id, season_id, squad_id, score, rank, tier, snapshot_at, tenant_id
  With indexes: (season_id, rank), (squad_id, season_id)
Outcome: League data model in place
```

### Step 14: League service methods
```
File: /home/mumega/SOS/sos/services/squad/service.py
Change: Add:
  get_current_season() → LeagueSeason | None
  get_league_table(season_id) → list[LeagueScore] ordered by rank
  snapshot_league_scores(season_id) → reads all squad KPIs, ranks them,
    assigns tiers (top 15%=construct, next 35%=fortress, rest=nomad),
    writes LeagueScore rows, updates squad.tier
Outcome: League scoring runs and updates tiers atomically
```

### Step 15: League API endpoints in Squad service
```
File: /home/mumega/SOS/sos/services/squad/app.py
Change:
  GET  /league              → current season standings (ranked squads)
  GET  /league/seasons      → season history
  POST /league/seasons      → start new season (admin only)
  POST /league/snapshot     → manual trigger for league scoring (admin)
Outcome: curl /league returns [{rank:1, squad:"dev", score:89, tier:"construct"}, ...]
```

### Step 16: Weekly tier promotion cron
```
File: /home/mumega/SOS/sos/services/squad/app.py
Change: APScheduler job (Monday 01:00 UTC): snapshot_league_scores(current_season)
  Also: on month boundary, close season + open next one automatically
Outcome: Tiers update weekly, seasons reset monthly without manual intervention
```

### Step 17: Inkwell proxy for league
```
File: /home/mumega/mumega.com/workers/inkwell-api/src/routes/dashboard.ts
Change: Add:
  GET /api/league → proxy to SOS Squad service /league
  GET /api/league/seasons → proxy to SOS Squad service /league/seasons
Outcome: Inkwell Worker exposes league data to dashboard
```

### Step 18: LeaguePanel React component
```
File: /home/mumega/mumega.com/plugins/dashboard/components/LeaguePanel.tsx
Change: New component. Calls GET /api/league + /api/league/seasons
  Layout:
  - Season header (name, days remaining, status badge)
  - Tier sections: Construct / Fortress / Nomad (like WoW achievement panels)
  - Per squad: rank badge, squad name, tier icon, kpi_score bar, wallet balance
  - Current squad highlighted (from localStorage squad context)
  - Season selector dropdown for history
Outcome: /dashboard/squads shows WoW-style league table
```

### Step 19: League page + nav entry
```
File: /home/mumega/mumega.com/src/pages/dashboard/league.astro  (new)
       /home/mumega/mumega.com/src/layouts/Dashboard.astro
Change: New page wrapping LeaguePanel client:load
  Add nav entry: { key: 'league', label: 'League', href: '/dashboard/league', icon: '⚔', requiredRole: 'member' }
Outcome: /dashboard/league is live and in the sidebar
```

---

## Deferred (Sprint 2)

- **Achievements** — milestone badges (first bounty, 100 tasks done, tier-up)
- **Squad chat** — real-time squad memory via SSE
- **Bounty → task bridge** — auto-create SOS task when bounty is claimed
- **Agent auto-join league** — agents self-register squad membership via MCP tool

---

## Build order

```
Phase 1 (memory):  Steps 1 → 2 → 3 → 4 → 5 → 6
Phase 2 (KPIs):    Steps 7 → 8 → 9 → 10 → 11 → 12
Phase 3 (league):  Steps 13 → 14 → 15 → 16 → 17 → 18 → 19
```

Each step is independent within its phase. Phases are sequential (Phase 2 needs KPI fields from Phase 1 being useful; Phase 3 needs KPI scores from Phase 2).
