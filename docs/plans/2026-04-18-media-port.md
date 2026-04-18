# Plan: MediaPort — AI-First Media Pipeline

**Date:** 2026-04-18
**Goal:** Add MediaPort as Inkwell's 14th kernel port with a media plugin (19th plugin), enabling AI-powered image and video handling for agent-operated sites.

## Architecture

```
Agent calls upload_media MCP tool
  → Worker receives file
    → R2 stores original
    → Workers AI (llama-3.2-vision) extracts: alt text, tags, objects, NSFW score
    → ThumbHash generated (pure JS)
    → CF Image Resizing registers variants (thumbnail, hero, og)
    → D1 stores metadata (media_assets table)
    → GraphPort upserts node (type='media', tags, OCR edges)
    → Returns asset_id + full metadata

Video variant:
  → CF Stream ingests video (encoding free)
  → Workers AI (whisper-large-v3-turbo) transcribes
  → LLM generates chapters
  → Stream provides HLS URL + thumbnail
  → Transcript + chapters stored in D1
  → GraphPort upserts node with transcript-derived edges
```

## MediaPort Interface

```typescript
interface MediaAsset {
  id: string
  tenant?: string
  filename: string
  contentType: string
  r2Key: string
  width?: number
  height?: number
  sizeBytes: number
  altText?: string
  description?: string
  tags: string[]
  thumbhash?: string
  nsfwScore?: number
  transcript?: string
  chapters?: Array<{ time: number; title: string }>
  variants: Record<string, string>  // name → URL
  graphSlug?: string
  createdAt: string
  updatedAt: string
}

interface MediaPort {
  upload(file: ArrayBuffer, filename: string, contentType: string, tenant?: string): Promise<MediaAsset>
  get(id: string): Promise<MediaAsset | null>
  describe(id: string): Promise<{ altText: string; description: string; tags: string[]; nsfwScore: number }>
  transcribe(id: string): Promise<{ transcript: string; chapters: Array<{ time: number; title: string }> }>
  transform(id: string, variant: string): Promise<string>  // returns URL
  search(query: string, tenant?: string, limit?: number): Promise<MediaAsset[]>
  list(tenant?: string, cursor?: string, limit?: number): Promise<{ assets: MediaAsset[]; cursor?: string }>
  delete(id: string): Promise<void>
  generateImage(prompt: string, tenant?: string): Promise<MediaAsset>
}
```

## Steps

### Step 1: MediaPort interface + types
- File: `kernel/types.ts`
- Add MediaAsset, MediaPort interface
- Pattern: same as other 13 ports

### Step 2: D1 migration
- File: `workers/inkwell-api/migrations/0011_media_assets.sql`
- CREATE TABLE media_assets with full metadata columns

### Step 3: CF Media adapter
- File: `kernel/adapters/cf-media.ts`
- R2 for storage, Workers AI for vision/whisper, CF Images for transforms
- D1 for metadata queries

### Step 4: Wire into middleware
- Files: `workers/inkwell-api/src/middleware/adapters.ts`, `src/types.ts`
- Add media: MediaPort to context, AI binding to Env

### Step 5: Media plugin
- Files: `plugins/media/manifest.ts`, `plugins/media/routes.ts`
- Routes: upload, get, list, delete, describe, transcribe

### Step 6: Register plugin
- Files: `workers/inkwell-api/src/index.ts`, `inkwell.config.ts`
- Add to plugin list + adapter config

### Step 7: MCP tools
- File: `plugins/mcp/mcp-tools.ts`
- Tools: upload_media, describe_image, generate_image, search_media

### Step 8: Graph integration
- In upload handler: upsert GraphNode type='media', OCR → edges

### Step 9: Tests
- File: `kernel/__tests__/media-port.test.ts`
- Mock adapter, metadata shape, search filtering

### Step 10: Docs
- Update README.md + CLAUDE.md: 14 ports, 19 plugins, media docs

## Cloudflare Services Used

| Service | Purpose | Binding |
|---------|---------|---------|
| R2 | Original file storage | MEDIA (existing) |
| Workers AI | Vision, Whisper, image gen | AI |
| Image Resizing | On-the-fly AVIF/WebP transforms | cf.image fetch option |
| Stream | Video hosting + HLS | STREAM (new, optional) |
| D1 | Media metadata | DB_CORE (existing) |

## MCP Tools (4 new, 16 total)

| Tool | Input | Output |
|------|-------|--------|
| upload_media | { url or base64, filename } | MediaAsset |
| describe_image | { asset_id } | { altText, description, tags } |
| generate_image | { prompt, style?, aspect_ratio? } | MediaAsset |
| search_media | { query, limit? } | MediaAsset[] |
