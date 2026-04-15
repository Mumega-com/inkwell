---
title: "mumcp — WordPress MCP Tools"
description: "239 AI-powered tools for WordPress management via Model Context Protocol. Build pages, manage content, SEO, WooCommerce — all from an AI agent."
status: shipped
repo: "https://github.com/your-org/mcp-for-wp"
stack: [typescript, wordpress, mcp, elementor]
tags: [wordpress, mcp, tools, elementor]
role_in_ecosystem: "The WordPress hand — how agents manage WordPress sites"
date: 2026-03-01
weight: 9
---

mumcp (formerly SitePilotAI) gives AI agents full control over WordPress sites through 239 MCP tools. Build Elementor pages, manage content, run SEO audits, handle WooCommerce — all via natural language.

## Categories

::comparison{title="MCP Tool Clusters"}
| Category | Tools | Purpose |
|---|---|---|
| Elementor | ~50 | Layout & Design |
| Content | ~28 | Ingest & Updates |
| SEO | ~10 | Audits & Indexing |
| WooCommerce | ~21 | Orders & Analytics |
::

Part of the [[topics/ai-developer-tools|AI Developer Tools]] stack. See the [[docs/config/api-reference|MCP API Reference]].

## Links

- [mumcp.your-domain.com](https://mumcp.your-domain.com)
- [GitHub](https://github.com/your-org/mcp-for-wp)

## Install

```bash
# WordPress plugin
wp plugin install mumcp --activate

# Connect your agent
{"mcpServers":{"mumcp":{"url":"https://your-site.com/wp-json/mumcp/v1/mcp"}}}
```
