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

### v6.1 — Cross-Tenant Graph (the mycelium) — SHIPPED 2026-04-18
- Cross-tenant edge resolution via GraphPort.resolveCrossTenantEdges()
- `GET /api/graph/network` — federated public graph
- `GET /api/graph/search?q=` — text search across network
- Privacy boundary enforced: only public nodes visible cross-tenant

### v6.2 — Managed Agent Integration — SHIPPED 2026-04-18
- `POST /api/organism/activate` — provisions managed agent per tenant
- AgentPort interface + D1AgentAdapter
- Per-tenant agent config (model, system prompt, MCP servers, tools)
- Budget tracking: daily + monthly caps, usage accumulation

### v6.3 — SOS Integration Ports — SHIPPED 2026-04-18
- BusPort + SOSBusAdapter + StandaloneBusAdapter
- MemoryPort + SOSMemoryAdapter + StandaloneMemoryAdapter
- EconomyPort + SOSEconomyAdapter + StandaloneEconomyAdapter
- SOS_MODE env var switches adapters automatically

### v7.0 — The Superorganism — SHIPPED 2026-04-18
- Agent-to-agent transactions: quote → respond → transact
- Graph-driven discovery: BFS + cross-tenant grouping
- Reputation scoring: PageRank-style (nodes + inbound × 3)
- Plugin marketplace: publish/install/uninstall via graph

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

## Metrics

| Metric | v6.0 | v7.0 (shipped) |
|--------|------|----------------|
| Ports | 8 | 11 (+ Agent, Bus, Memory, Economy) |
| Plugins | 16 | 17 (+ organism) |
| Tests | 90 | 100 |
| Bundle | 353 KiB | 383 KiB |
| Organisms | 1 | ready for 1,000+ |
| Graph edges | manual | self-organizing |
| Agent cost/mo | n/a | ~$5 (Haiku-first) |

---

## Next

### v7.1+ — Hardening
- Anthropic Managed Agent API integration (actual provisioning call)
- Mirror tenant isolation (blocked on SOS v0.8.0)
- Bus SSE streaming (blocked on SOS v0.8.x)
- Economy MCP tools (blocked on SOS v0.7.3)
- GC/AWS adapter implementations
- More tests (target 200+)
- Plugin marketplace UI in dashboard
