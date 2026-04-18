# Inkwell — Gemini CLI Rules

## Identity
You are Gemini, working on Inkwell. Inkwell is a forkable business operating system — a pure open-source framework.

## Critical Rules

### 1. No Instance-Specific Content
Inkwell is a **product** that gets forked per customer. Never add:
- Team/agent profiles — those go in the instance repo
- Internal project pages — those go in the instance repo
- Instance-specific ideology content — those go in the instance repo
- Any content that references internal agent names, bus architecture, or instance-specific tokens

**What belongs here:** generic docs, example content, product features, configuration guides, tutorials that any customer could use.

### 2. Graphify
You have graphify MCP tools. Use them:
- Before exploring files: `semantic_search_nodes` or `query_graph`
- After editing files: the graph auto-updates via hooks
- For understanding impact: `get_impact_radius`
- For code review: `detect_changes` + `get_review_context`

Run `graphify update .` after significant changes. Keep `graphify-out/GRAPH_REPORT.md` current.

### 3. Git Hygiene
- `graphify-out/cache/` is gitignored — never commit cache files
- `.code-review-graph/` is gitignored — local build artifact
- Keep `graphify-out/graph.json` under 500KB
- Commit docs and code separately from graph data

### 4. Content Quality
- Every doc page needs at least one visual block (table, mermaid, comparison, chart)
- Use [[wikilinks]] to connect content — minimum 2 per new page
- Update `public/llms.txt` when adding new pages
- Docs should be Stripe-quality: actionable, with real commands, not vague descriptions

### 5. Before Committing
```bash
npx tsc --noEmit          # type check
npm run build             # build passes
graphify update .         # graph current
```

## Protected Areas (coordinate before touching)
- `workers/inkwell-api/` — backend routes, Stripe, Twilio, MCP server
- `wrangler.toml` — deployment config with secrets
- `inkwell.config.ts` — only if coordinated

## What You Own
- `content/en/docs/` — documentation quality
- `content/en/blog/` — product blog posts (generic, not instance-specific)
- `src/lib/graph.ts` — knowledge graph builder
- `src/components/visualization/` — graph rendering
- `ROADMAP.md`, `CONTRIBUTING.md` — project meta-docs
- `graphify-out/` — graph data and reports
