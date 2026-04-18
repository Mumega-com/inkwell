# Inkwell Roadmap

## Shipped

### v5.0 — Microkernel Wired (2026-04-18)
- Kernel contracts: types, plugin-loader, adapter-registry, roles, theme
- 16 plugins with manifests, mountRoutes, mcpTools, requiredRole
- RBAC enforcement per-plugin with system token bypass
- D1DatabaseAdapter: all 90 DB call sites migrated to hexagonal ports
- 12 MCP tools decentralized to plugin ownership

### v5.3 — Test Suite + CI (2026-04-18)
- 41 kernel unit tests (plugin-loader, adapter-registry, roles, D1 adapter)
- `scripts/fork-smoke.sh` — automated fork test
- `.github/workflows/ci.yml` — PR gate: typecheck + tests + fork smoke

### v5.4 — Full Port Isolation (2026-04-18)
- SessionPort + KVSessionAdapter
- ContentPort + KVContentAdapter
- StoragePort + R2StorageAdapter
- Per-request adapters via Hono context (no race conditions)
- Zero c.env.DB_*, c.env.SESSIONS, c.env.CONTENT in plugins
- Plugin layer is cloud-portable (CF → GC → AWS, swap adapters)

### v6.0 — MDX Knowledge Engine (2026-04-18)
- 3 kernel processors extracted from shabrang-cms:
  - remark-wikilinks (configurable, no global state)
  - remark-blocks (14 block types)
  - mdx-compiler (runtime compiler for Workers)
- GraphPort — 8th hexagonal port (upsert, backlinks, BFS neighbors, query)
- D1GraphAdapter + migration 0009 (graph_nodes, graph_edges)
- POST /api/ingest — raw MDX → compile → store → graph
- GET /api/graph, /graph/node/:slug, /graph/backlinks/:slug
- Publish auto-feeds graph (wikilink + tag edges)
- 90 tests, 353 KiB bundle

---

## Next

### v6.1 — Cross-Tenant Graph (the mycelium)
**Goal:** Organisms discover each other through their own documentation.

- Cross-tenant edge resolution: when tenant A links to `[[flour-supplier]]` and tenant B's node is named `flour-supplier`, create a cross-tenant edge
- Public graph federation: `GET /api/graph/network` — aggregated public nodes across tenants
- Graph search: `GET /api/graph/search?q=organic+flour` — semantic search across the network
- Privacy boundary: only public nodes visible cross-tenant, private stays private
- Backlink notifications: when another organism links to you, notify via bus
- Output: **businesses find each other by documenting themselves, not by searching**

### v6.2 — Managed Agent Integration
**Goal:** Each organism gets its own agent via Anthropic Managed Agents.

- `POST /api/organism/activate` — provisions a Managed Agent (model + MCP + environment)
- Agent config stored per tenant (system prompt, tools, MCP server URL)
- Agent connects to SOS MCP for bus, memory, tasks
- Agent connects to Inkwell MCP for content, graph, commerce
- Budget tracking per organism (session-hours + tokens)
- Haiku-first metabolism: routine ops on cheap model, escalate to Sonnet for judgment
- Output: **customer signs up, gets an AI operator that documents and runs their business**

### v6.3 — SOS Integration Ports
**Goal:** Inkwell organisms can coordinate through the nervous system.

- BusPort — send(), broadcast(), subscribe() via SOS bus
- MemoryPort — remember(), recall(), search() via Mirror
- EconomyPort — recordUsage(), getBalance(), charge() via SOS Economy
- SOS adapters (Redis bus, Mirror API, Economy service)
- Standalone adapters (no-op bus, KV memory, Stripe direct)
- Config: `mode: 'sos' | 'standalone'`
- Output: **organisms talk to each other, remember everything, trade value**

### v7.0 — The Superorganism
**Goal:** The network runs itself.

- Agent-to-agent transactions: quote → negotiate → contract → payment (no human needed for routine)
- Graph-driven discovery: agents find suppliers/partners through cross-tenant edges
- Economy loops: organisms earn tokens by helping the network, spend tokens on compute
- Self-organizing supply chains: tag clusters become industry verticals automatically
- Reputation from graph: organisms with more backlinks = more trusted (PageRank for businesses)
- Plugin marketplace: community-built plugins installed per-tenant from the graph
- Output: **an economy of AI-operated businesses that coordinate through shared documentation**

---

## Architecture at v7.0

```
Customer signs up
  → Inkwell fork provisioned (subdomain, KV, D1, R2)
  → Managed Agent activated (Anthropic cloud, MCP connected)
  → Agent documents the business (MDX → graph)
  → Public pages = website, private pages = ops wiki
  → Wiki-links create edges, edges discover other organisms
  → Agents transact through SOS bus
  → Economy tokens flow between organisms
  → The network grows smarter with every page published
```

## Metrics That Matter

| Metric | v6.0 (now) | v7.0 (target) |
|--------|-----------|---------------|
| Ports | 8 | 11 (+ Bus, Memory, Economy) |
| Plugins | 16 | 20+ (community marketplace) |
| Tests | 90 | 200+ |
| Bundle | 353 KiB | < 500 KiB |
| Organisms | 1 (Viamar) | 1,000+ |
| Graph edges | manual | self-organizing |
| Agent cost/mo | n/a | ~$5 (Haiku-first) |
