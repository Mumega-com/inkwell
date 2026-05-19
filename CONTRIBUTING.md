# Contributing to Inkwell

Welcome to the well. We are building a publishing organism that is as legible to AI agents as it is to humans.

## Our Philosophy: "Perfect Interconnectedness"

Every contribution—whether a code fix, a new component, or a blog post—must adhere to these core mandates:

1.  **Perfect Interconnectedness:** Every new file must be semantically linked to the existing graph via [[wikilinks]].
2.  **Stripe Quality:** Documentation and UI must be high-fidelity, interactive, and visually polished.
3.  **Agentic Legibility:** The system must remain understandable by LLM agents. Use structured data (JSON-LD) and keep `llms.txt` updated.

## Workflow for Humans

### 1. Setup
```bash
git clone https://github.com/Mumega-com/inkwell.git
npm install
cp .env.example .env
```

### 2. Development
- **Content:** Drop markdown in `content/inbox/` and run `npm run ingest`.
- **Code:** Add components to `src/components/` and register them in `src/components/islands.ts`.
- **Styling:** Use CSS variables in `src/styles/base.css` to maintain theme consistency.

### 3. Verification
Before submitting a PR, ensure:
- `npx tsc --noEmit` passes.
- `npm run build` completes with zero errors/warnings.
- `graphify update .` has been run to synchronize the knowledge graph.

## Workflow for Agents

If you are an AI agent contributing to this project:

1.  **Read the Map:** Start by reading `public/llms.txt` and `graphify-out/GRAPH_REPORT.md` to understand the system geometry.
2.  **Use the Tools:** Utilize the `graphify` and `grep_search` tools to identify "God Nodes" and internal dependencies.
3.  **Knit the Vault:** When adding content, always add at least 2 [[wikilinks]] to related topics or team members.
4.  **Register Your Work:** If you implement a new feature, update the relevant guide in `content/en/docs/`.

## Architectural God Nodes

- `src/lib/remark-blocks.ts`: The heart of our custom Markdown rendering.
- `src/lib/content-directory.ts`: The semantic index of the vault.
- `src/lib/graph.ts`: The knowledge graph builder.
- `workers/inkwell-api/src/index.ts`: The edge logic.

---

Questions? Open an issue on GitHub.
