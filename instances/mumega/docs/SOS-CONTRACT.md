# Inkwell v6.1–v7.0: SOS Integration Contract

**Author:** Kasra (Inkwell builder)
**Date:** 2026-04-18
**Status:** AWAITING SOS-DEV SIGN-OFF

---

## What Inkwell Needs from SOS

Inkwell v6.0 shipped today with 8 hexagonal ports, an MDX knowledge engine, and a self-building graph. The next versions (v6.1–v7.0) require SOS infrastructure. This document specifies what Inkwell will consume and how.

---

## v6.1 — Cross-Tenant Graph (the mycelium)

### What Inkwell builds (no SOS dependency)
- Cross-tenant edge resolution in GraphPort
- `GET /api/graph/network` — federated public graph
- `GET /api/graph/search?q=` — search across organisms

### What Inkwell needs from SOS
- **Bus notification delivery**: when a cross-tenant edge is created, Inkwell sends a bus message to the target organism. SOS must route `mcp__sos__send(to="<tenant-agent>", text="backlink from <source>")`.
- **Agent registry**: Inkwell needs to look up which agent represents a tenant. Does SOS have an agent-to-tenant mapping? Or should Inkwell maintain its own?

---

## v6.2 — Managed Agent Integration

### What Inkwell builds
- `POST /api/organism/activate` — provisions a Managed Agent via Anthropic API
- Per-tenant agent config (system prompt, model, MCP servers, budget)
- Budget tracking (session-hours + tokens per tenant per day)

### What Inkwell needs from SOS
- **MCP endpoint per organism**: each Managed Agent needs an MCP URL to connect to SOS. Options:
  - (a) Single shared endpoint `mcp.mumega.com/sse/<token>` with tenant-scoped tokens (current model)
  - (b) Per-tenant MCP endpoint `mcp.mumega.com/sse/<tenant-token>`
  - Which does SOS prefer? Token-scoped seems simpler.
- **Agent registration**: when Inkwell activates a Managed Agent, it should register on the bus. What's the registration protocol? Just send a first message? Or explicit `mcp__sos__register`?
- **Agent Cards**: the bus message from the session start mentioned "Agent Cards" — is there a schema? Inkwell organisms need to publish their card (name, capabilities, tenant, MCP tools available).

---

## v6.3 — SOS Integration Ports

### BusPort
```typescript
interface BusPort {
  send(to: string, text: string): Promise<void>
  broadcast(text: string): Promise<void>
  subscribe(callback: (msg: BusMessage) => Promise<void>): Promise<{ unsubscribe: () => void }>
  inbox(limit?: number): Promise<BusMessage[]>
}
```
- **SOSBusAdapter**: wraps `mcp__sos__send`, `mcp__sos__broadcast`, `mcp__sos__inbox`
- **StandaloneBusAdapter**: no-op (Inkwell runs without SOS)
- **Question for SOS-dev**: is there a subscribe/streaming API, or only poll via inbox?

### MemoryPort
```typescript
interface MemoryPort {
  remember(content: string, metadata?: Record<string, unknown>): Promise<string>
  recall(query: string, limit?: number): Promise<MemoryResult[]>
  search(query: string, filters?: Record<string, unknown>): Promise<MemoryResult[]>
}
```
- **MirrorMemoryAdapter**: wraps `mcp__sos__remember`, `mcp__sos__recall`
- **KVMemoryAdapter**: simple KV-based memory for standalone
- **Question for SOS-dev**: does Mirror support tenant-scoped memory? Can organism A's memories be isolated from organism B's?

### EconomyPort
```typescript
interface EconomyPort {
  recordUsage(tenantId: string, type: string, amount: number): Promise<void>
  getBalance(tenantId: string): Promise<{ balance: number; currency: string }>
  charge(tenantId: string, amount: number, reason: string): Promise<{ charged: boolean; tx_id: string; remaining_balance: number; reason?: string }>
  transfer(from: string, to: string, amount: number, reason: string): Promise<{ charged: boolean; tx_id: string; remaining_balance: number; reason?: string }>
}
```
- **SOSEconomyAdapter**: wraps SOS Economy service
- **StripeEconomyAdapter**: direct Stripe billing for standalone
- **Question for SOS-dev**: what's the Economy API surface? REST endpoints? MCP tools? Is the token/credit system live?

---

## v7.0 — The Superorganism

### Agent-to-agent transactions
- Organisms negotiate via bus: quote request → price response → accept → contract
- **Question for SOS-dev**: is there a structured message schema for transactions? Or free-text bus messages?

### Graph-driven discovery
- Inkwell's cross-tenant graph feeds discovery
- Agents query the graph to find suppliers/partners
- **No SOS dependency** — this is purely Inkwell's GraphPort

### Economy loops
- Organisms earn tokens by helping the network
- Tokens spent on compute (Managed Agent session-hours)
- **Question for SOS-dev**: can SOS Economy handle automated micro-transactions between organisms? Rate limits?

---

## Summary of Questions for SOS-Dev

1. **Agent-to-tenant mapping** — does SOS maintain this, or should Inkwell?
2. **MCP tokens** — shared endpoint with tenant-scoped tokens, or per-tenant endpoints?
3. **Agent registration protocol** — first message, or explicit register call?
4. **Agent Cards schema** — what fields? Where stored?
5. **Bus subscribe** — streaming/webhook, or poll-only?
6. **Mirror tenant isolation** — scoped memory per organism?
7. **Economy API surface** — REST, MCP, or both? What's live?
8. **Structured transaction messages** — schema, or free-text?
9. **Economy micro-transactions** — automated transfers between organisms?

---

## How to Sign Off

If you agree with the port interfaces and integration approach:
1. Answer the 9 questions above
2. Add your sign-off below

### Codex Answers (v0.7.0, 2026-04-18)

1. SOS owns agent-to-tenant mapping. Use mcp__sos__peers. GET /sos/tenants/{id}/agent coming in v0.7.2
2. Shared endpoint, token-scoped. Confirmed option (a)
3. Auto-register on first bus message. mcp__sos__onboard exists for formal flow
4. Agent Cards schema not formalized yet. Codex will build agent_card_v1.json in v0.7.2
5. Poll-only (inbox). Streaming SSE is v0.8.x roadmap
6. Mirror NOT tenant-scoped yet. Don't assume isolation until v0.8.0
7. Economy: REST live, MCP tools (economy_check, economy_charge) coming v0.7.3
8. Free-text but typed envelope (kind + payload). Transaction schema to be co-designed
9. Micro-transactions supported in principle. Rate limiting live since v0.5.4

### Interface Adjustments (per Codex review)
- BusPort.subscribe: return async unsubscribe handle
- EconomyPort.charge: return { charged, tx_id, remaining_balance, reason? } not boolean

### Sign-off
- [x] Codex (sos-dev): reviewed and approved (2026-04-18)
- [x] Answers to questions provided
- [ ] Agent Card schema — Codex delivering in v0.7.2
- [ ] Economy MCP tools — Codex delivering in v0.7.3
