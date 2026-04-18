# Content Source Port — Obsidian, Notion, GitHub, Google Drive

**Date:** 2026-04-18
**Approach:** Option A — ContentSourcePort as 13th kernel port

## Architecture

```
inkwell.config.ts
  contentSources: [
    { type: 'obsidian', vaultPath: './vault' },
    { type: 'github', repo: 'owner/repo', branch: 'main', path: 'content/' },
    { type: 'notion', databaseId: 'abc123' },
    { type: 'gdrive', folderId: 'xyz789' },
  ]
       |
   kernel/types.ts        ContentSourcePort interface
       |
   kernel/adapters/       source-obsidian.ts, source-github.ts, source-notion.ts, source-gdrive.ts
       |
   plugins/sync/          Thin plugin: POST /api/sync triggers sources --> feeds /api/ingest
```

## Port Interface

```typescript
interface ContentSourceItem {
  slug: string
  title: string
  content: string        // raw markdown/MDX
  updatedAt: string      // ISO timestamp
  metadata?: Record<string, unknown>
}

interface ContentSourcePort {
  name: string
  list(): Promise<ContentSourceItem[]>
  sync(since?: string): Promise<ContentSourceItem[]>  // only changed since timestamp
}
```

## Steps

1. Add ContentSourcePort to kernel/types.ts
2. Obsidian adapter (file system, mtime-based change detection)
3. GitHub adapter (GitHub API, commit SHA-based change detection)
4. Notion adapter (Notion API, last_edited_time filter)
5. Google Drive adapter (Drive API, modifiedTime filter)
6. Config + factory wiring
7. Sync plugin (POST /api/sync)
8. Tests
9. Register plugin + update README
