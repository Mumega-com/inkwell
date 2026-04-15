---
title: "Troubleshooting & FAQ"
description: "Resolving common issues with setup, deployment, and content management."
parent: "index"
order: 16
tags: ["support", "faq", "docs"]
---

Welcome to the Guardian's Guide. If you've run into friction while building with Inkwell, start here.

## Common Friction Points

::comparison{title="Issue Resolution"}
| Symptom | Likely Cause | Solution |
|---|---|---|
| **Build fails on dynamic routes** | Missing `getStaticPaths` | Every `[id].astro` file must export `getStaticPaths`. See our dynamic route guide. |
| **Search results not appearing** | Pagefind index missing | Ensure `npm run postbuild` runs after `npm run build`. |
| **Worker API returns 404** | Missing D1 migrations | Run `wrangler d1 migrations apply inkwell-analytics` for local or prod. |
| **KaTeX warnings in build** | Incompatible characters | Replace Unicode en-dashes (`–`) with standard hyphens (`-`) inside math blocks. |
::

## Frequently Asked Questions (FAQ)

::faq
Question: Can I use Inkwell without a Cloudflare account?
Answer: You can develop locally using the Astro dev server and Miniflare for workers, but production deployment requires a Cloudflare Pages account.

Question: How do I add a new content collection?
Answer: 1. Create the folder in `content/en/`. 2. Define the schema in `src/content.config.ts`. 3. Add a dynamic route in `src/pages/[collection]/[id].astro`.

Question: Why aren't my [[wikilinks]] resolving?
Answer: Ensure the target file exists in the `content/` directory and that its ID or slug matches your link exactly. Check `src/lib/content-directory.ts` for resolution logic.

Question: Can agents publish content automatically?
Answer: Yes. Use the [[config/api-reference|MCP Publish Tool]] to allow authorized agents to drop markdown into the inbox and trigger a build.
::

## Debugging Tools

### 1. The Knowledge Graph
Visit `/explore` to see a visual map of your project. If a page isn't appearing as a node, it likely has frontmatter errors or is missing from the `content.config.ts`.

### 2. Search Indexing
Run `npx pagefind --site dist` manually to inspect which files are being indexed. If a file is ignored, ensure it has a `<body>` tag or a `data-pagefind-body` attribute.

### 3. Worker Logs
Use `wrangler tail inkwell-api` to see real-time errors from your edge functions (Feedback, Reactions, etc.).

---

[[reference/internal-abstractions|Review Internal Abstractions]] or [[getting-started|Return to Getting Started]].
