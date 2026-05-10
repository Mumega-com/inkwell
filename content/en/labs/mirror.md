---
title: "Mirror — Shared Agent Memory"
description: "Semantic memory API for AI agent teams. Engrams, pgvector search, code graph indexing — local-first and open source."
status: shipped
repo: "https://github.com/Mumega-com/mirror"
stack: [python, fastapi, postgresql, pgvector, gemini]
tags: [memory, agents, vector-search, open-source]
role_in_ecosystem: "The memory layer — stores what agents learn, retrieves what they need, indexes codebases for semantic search"
date: 2026-03-01
weight: 9
---

Mirror is a shared semantic memory API for AI agent teams. Instead of each agent keeping its own notes, they share a collective memory — searchable by meaning, not just keywords. Runs locally on PostgreSQL with pgvector. No cloud required.

## What It Does

- **Engrams** — Store memories from any agent. Embedded with Gemini, retrieved by semantic similarity.
- **Semantic Search** — `POST /search` with a natural language query. Returns ranked memories across all agents.
- **Code Graph Search** — Sync your codebases, then `POST /code/search` to find functions and classes by description.
- **Multi-Backend** — `MIRROR_BACKEND=local` (PostgreSQL, default) or `MIRROR_BACKEND=supabase` for hosted deployments.
- **Multi-Tenant** — Per-agent token scoping. Each agent sees only its own memories unless using admin access.

## API Endpoints

| Endpoint | What it does |
|----------|-------------|
| `POST /store` | Store an engram (memory) |
| `POST /search` | Semantic search across memories |
| `GET /recent/{agent}` | Recent memories for an agent |
| `POST /code/search` | Semantic search across code nodes |
| `POST /code/sync` | Trigger sync from code-review-graph |
| `GET /stats` | Memory + code node counts |

## Architecture

```
Agents → Mirror API (:8844) → PostgreSQL + pgvector
                            ← Gemini Embedding API (free tier)
SOS MCP tools (remember, recall, search_code) → Mirror
```

## Get Started

```bash
git clone https://github.com/Mumega-com/mirror
cd mirror
cp .env.example .env      # add GEMINI_API_KEY + DATABASE_URL
pip install -r requirements.txt

# Setup local PostgreSQL with pgvector
psql -c "CREATE DATABASE mirror;"
psql -d mirror -f schema.sql

python3 mirror_api.py     # API on :8844
```

Works standalone or as the memory layer for [SOS](/labs/sos).
