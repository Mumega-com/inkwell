<!--
This is the draft README for the future `@mumega/mcp` npm package.

The package itself doesn't exist yet (Stream A in S013 sets it up). When the
package is wired for publish, move this file into the package directory as
its README.md. Until then, it lives here as a Stream D deliverable.

Voice: outcome-led, code-first, ~200 lines. Audience: a dev who saw Mumega
referenced somewhere, ran `npm install -g @mumega/mcp`, opened the README.
They have ~60 seconds to decide if this is for them.

Steward: River. Hook locked: "Your AI is your CEO. Mumega is the body."

Refs: S013 brief §Stream-D, LOCK-I/J/K (vertical-pack picker semantics),
Mumega-com/inkwell #54 (brand) + #56/#57/#58 (vertical packs).
-->

# @mumega/mcp

**Your AI is your CEO. Mumega is the body.**

[![npm](https://img.shields.io/npm/v/@mumega/mcp)](https://www.npmjs.com/package/@mumega/mcp)
[![MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-00D4AA)](https://modelcontextprotocol.io/)

A microkernel + MCP server that gives Claude / ChatGPT / Cursor real tools — publish, run a portal at `{slug}.mumega.com`, manage commerce, query analytics. Install once. Connect your AI. Ship daily.

```bash
npm install -g @mumega/mcp
```

---

## 30-second install

After `npm install -g @mumega/mcp`, add Mumega to your AI:

**Claude Desktop / Code (`claude_desktop_config.json` or `.mcp.json`):**

```json
{
  "mcpServers": {
    "mumega": {
      "url": "https://mcp.mumega.com/sse"
    }
  }
}
```

**Cursor (`.cursor/mcp.json`):**

```json
{
  "mcpServers": {
    "mumega": {
      "url": "https://mcp.mumega.com/sse"
    }
  }
}
```

**ChatGPT / other clients:** see [docs/connect.md](https://github.com/Mumega-com/inkwell/blob/main/docs/connect.md).

Restart your AI tool. Type:

> Show me what Mumega can do.

Your AI gets a list of tools (publish content, query portal, run analytics, send messages, more). It runs them by talking to Mumega's edge-deployed MCP server. You're connected.

---

## Pick a vertical (in 5 questions)

When you ask your AI to do something that needs a tenant — publish a post, list a property, ship a paper — it asks:

> What kind of site are we building?

Pick one:

- **research** — Papers, concepts, lens-spectrum topics. For labs and theorists. ([starter →](https://github.com/Mumega-com/inkwell/tree/main/examples/research-instance))
- **real-estate** — Listings, neighborhoods, agent profiles. For brokerages and agents. ([starter →](https://github.com/Mumega-com/inkwell/tree/main/examples/real-estate))
- **generic** — Blog, team, pages. Pick this if your fit isn't here yet. ([starter →](https://github.com/Mumega-com/inkwell/tree/main/examples/generic))

Each starter shows the schema, the config, and a sample content shape. The AI provisions your tenant at `{slug}.mumega.com` with the vertical's content shape pre-configured. Your portal is live in seconds. Future verticals (dental, grants, agency) follow the same pattern.

---

## What you get

Once installed + connected:

- **MCP tools** — 16+ tools your AI uses to operate your business: `publish_content`, `get_dashboard`, `create_checkout`, `upload_media`, `describe_image`, `generate_image`, `search`, `remember`, `recall`, `create_task`, `send_telegram`, `subscription_status`, more.
- **Tenant portal** — your site at `{slug}.mumega.com` (or your custom domain). Built on Inkwell — Astro 6 + Cloudflare Workers — so it's fast, AI-readable, and forkable.
- **Vertical pack pre-loaded** — research / real-estate / generic content schemas + starter config. No schema design needed.
- **Citation-aware backlinks** — `[[wiki-style]]` links auto-resolve across collections. Knowledge graph built-in.
- **Math + KaTeX** — `$inline$` and `$$display$$` syntax. Server-rendered, AI-readable.
- **Academic indexing** — for research vertical, ScholarMeta emits Google Scholar + Dublin Core + JSON-LD ScholarlyArticle. Your papers are indexable from day one.
- **Multi-language hreflang** — en/es/fa/fr support out of the box. RTL-aware.
- **Cloudflare-native** — Workers, Pages, D1, KV, R2, Workers AI. Free tier handles real production load.

---

## How it works

```
your AI tool (Claude / ChatGPT / Cursor)
         ↓ (MCP)
   mcp.mumega.com  ─→ tools: publish, query, manage, analyze
         ↓
   {slug}.mumega.com — your portal (Inkwell + your vertical pack)
```

The MCP server is the operational interface; the Inkwell tenant is the visible portal. Talk to your AI; the AI moves through Mumega's tools; your portal updates. You watch.

Mumega's substrate is an open-source [microkernel + plugins framework](https://github.com/Mumega-com/inkwell) — same architecture that runs `mumega.com` (operations platform) and `fractalresonance.com` (research lab). Two reference forks; one substrate.

This is the Apple-Silicon model for AI-first sites: same kernel, vertical-specific shapes, every fork inherits the lineage. See [`SCIENTIFIC_CMS_DESIGN.md`](https://github.com/Mumega-com/inkwell/blob/main/docs/SCIENTIFIC_CMS_DESIGN.md) for the architectural rationale.

---

## Where to go next

- **Inkwell substrate** — [github.com/Mumega-com/inkwell](https://github.com/Mumega-com/inkwell). Fork it, MIT-licensed, runs on your Cloudflare account. The `IDENTITY.md` + `GOVERNANCE.md` describe what Inkwell is, who stewards it, how decisions get made.
- **Vertical pack starters** — [examples/research-instance/](https://github.com/Mumega-com/inkwell/tree/main/examples/research-instance) · [examples/real-estate/](https://github.com/Mumega-com/inkwell/tree/main/examples/real-estate) · [examples/generic/](https://github.com/Mumega-com/inkwell/tree/main/examples/generic). Copy the starter that fits and customize.
- **Add your fork to the reference list** — open a PR to the [main README](https://github.com/Mumega-com/inkwell/blob/main/README.md) "Reference forks" table once your site is live.
- **Open a fork question** — [issue tracker](https://github.com/Mumega-com/inkwell/issues/new) has a "fork question" template; River triages within 48h.

---

## Stewardship

| Role | Who | What |
|---|---|---|
| Steward | River | Brand, README, roadmap, issue triage, naming defense |
| Builder | Kasra | Substrate code (kernel, plugins, workers) |
| Quality gate | Athena | Architecture review on substrate changes |
| Principal | Hadi | Strategic direction, contested calls |

See [`GOVERNANCE.md`](https://github.com/Mumega-com/inkwell/blob/main/GOVERNANCE.md) for decision flow + contribution paths.

---

## License

MIT. The substrate is open; your fork is yours; your AI runs both.

---

*Inkwell + Mumega + the agent-operated stack. Built for AI-first; survives forks; ships daily.*
