/**
 * CfMediaAdapter — Cloudflare R2 + D1 + Workers AI implementation of MediaPort.
 *
 * Uses R2 for blob storage, D1 for metadata, and optional Workers AI
 * for image description, audio transcription, and image generation.
 * Plugins never import R2/D1/AI types directly — they use MediaPort.
 */
import type { DatabasePort, MediaAsset, MediaPort } from '../types'

/** Minimal R2 interface — avoids importing @cloudflare/workers-types in kernel. */
interface R2Binding {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: Array<{ key: string }>; cursor?: string }>
}

interface R2Object {
  body: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

/** Minimal Workers AI interface — avoids importing @cloudflare/ai in kernel. */
interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>
}

interface CfMediaAdapterOptions {
  r2: R2Binding
  db: DatabasePort
  ai?: AiBinding
  siteUrl?: string
}

/** D1 row shape for the media_assets table. */
interface MediaRow {
  id: string
  tenant: string
  filename: string
  content_type: string
  r2_key: string
  width: number | null
  height: number | null
  size_bytes: number
  alt_text: string | null
  description: string | null
  tags: string | null
  thumbhash: string | null
  nsfw_score: number | null
  transcript: string | null
  chapters: string | null
  variants: string | null
  graph_slug: string | null
  source_type: string
  created_at: string
  updated_at: string
}

/** Named variant presets for CF Image Resizing. */
const VARIANT_PRESETS: Record<string, string> = {
  thumbnail: 'width=200,format=auto,quality=85',
  hero: 'width=1200,format=auto,quality=85',
  og: 'width=1200,height=630,fit=cover,format=auto,quality=85',
}

/** Extract dominant color hex codes from an AI image description. */
function extractDominantColors(description: string): string {
  const hexPattern = /#[0-9a-fA-F]{6}\b/g
  const matches = description.match(hexPattern)
  if (matches && matches.length >= 2) {
    return `linear-gradient(135deg, ${matches[0]}, ${matches[1]})`
  }
  if (matches && matches.length === 1) {
    return `linear-gradient(135deg, ${matches[0]}, ${matches[0]}88)`
  }
  // Fallback: neutral dark gradient
  return 'linear-gradient(135deg, #1a1a2e, #16213e)'
}

function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function parseJsonSafe<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    tenant: row.tenant || undefined,
    filename: row.filename,
    contentType: row.content_type,
    r2Key: row.r2_key,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.size_bytes,
    altText: row.alt_text ?? undefined,
    description: row.description ?? undefined,
    tags: parseJsonSafe<string[]>(row.tags, []),
    thumbhash: row.thumbhash ?? undefined,
    nsfwScore: row.nsfw_score ?? undefined,
    transcript: row.transcript ?? undefined,
    chapters: parseJsonSafe<Array<{ time: number; title: string }> | undefined>(row.chapters, undefined),
    variants: parseJsonSafe<Record<string, string>>(row.variants, {}),
    graphSlug: row.graph_slug ?? undefined,
    sourceType: row.source_type as MediaAsset['sourceType'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CfMediaAdapter implements MediaPort {
  private readonly r2: R2Binding
  private readonly db: DatabasePort
  private readonly ai?: AiBinding
  private readonly siteUrl: string

  constructor(opts: CfMediaAdapterOptions) {
    this.r2 = opts.r2
    this.db = opts.db
    this.ai = opts.ai
    this.siteUrl = opts.siteUrl ?? ''
  }

  async upload(file: ArrayBuffer, filename: string, contentType: string, tenant?: string): Promise<MediaAsset> {
    const id = crypto.randomUUID()
    const tenantKey = tenant ?? 'default'
    const r2Key = `media/${tenantKey}/${id}/${filename}`
    const now = new Date().toISOString()
    const graphSlug = slugFromFilename(filename)

    await this.r2.put(r2Key, file, { httpMetadata: { contentType } })

    let altText: string | undefined
    let description: string | undefined
    let tags: string[] = []
    let nsfwScore: number | undefined
    let thumbhash: string | undefined

    if (this.ai && contentType.startsWith('image/')) {
      try {
        const described = await this.describeBuffer(file)
        altText = described.altText
        description = described.description
        tags = described.tags
        nsfwScore = described.nsfwScore
        thumbhash = described.thumbhash || undefined
      } catch {
        // AI description is best-effort — don't block upload
      }
    }

    await this.db.execute(
      `INSERT INTO media_assets (id, tenant, filename, content_type, r2_key, size_bytes,
        alt_text, description, tags, thumbhash, nsfw_score, graph_slug, source_type, variants, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantKey, filename, contentType, r2Key, file.byteLength,
        altText ?? null, description ?? null, JSON.stringify(tags), thumbhash ?? null, nsfwScore ?? null,
        graphSlug, 'upload', JSON.stringify({}), now, now]
    )

    return {
      id,
      tenant: tenantKey,
      filename,
      contentType,
      r2Key,
      sizeBytes: file.byteLength,
      altText,
      description,
      tags,
      thumbhash,
      nsfwScore,
      variants: {},
      graphSlug,
      sourceType: 'upload',
      createdAt: now,
      updatedAt: now,
    }
  }

  async get(id: string): Promise<MediaAsset | null> {
    const row = await this.db.queryOne<MediaRow>(
      'SELECT * FROM media_assets WHERE id = ? LIMIT 1', [id]
    )
    if (!row) return null
    return rowToAsset(row)
  }

  async describe(id: string): Promise<{ altText: string; description: string; tags: string[]; nsfwScore: number }> {
    if (!this.ai) {
      return { altText: '', description: '', tags: [], nsfwScore: 0 }
    }

    const row = await this.db.queryOne<MediaRow>(
      'SELECT * FROM media_assets WHERE id = ? LIMIT 1', [id]
    )
    if (!row) throw new Error(`Media asset not found: ${id}`)

    const obj = await this.r2.get(row.r2_key)
    if (!obj) throw new Error(`R2 object not found: ${row.r2_key}`)

    const buffer = await obj.arrayBuffer()
    const result = await this.describeBuffer(buffer)

    const now = new Date().toISOString()
    await this.db.execute(
      `UPDATE media_assets SET alt_text = ?, description = ?, tags = ?, thumbhash = ?, nsfw_score = ?, updated_at = ?
       WHERE id = ?`,
      [result.altText, result.description, JSON.stringify(result.tags), result.thumbhash || null, result.nsfwScore, now, id]
    )

    return result
  }

  async transcribe(id: string): Promise<{ transcript: string; chapters: Array<{ time: number; title: string }> }> {
    if (!this.ai) {
      return { transcript: '', chapters: [] }
    }

    const row = await this.db.queryOne<MediaRow>(
      'SELECT * FROM media_assets WHERE id = ? LIMIT 1', [id]
    )
    if (!row) throw new Error(`Media asset not found: ${id}`)

    const obj = await this.r2.get(row.r2_key)
    if (!obj) throw new Error(`R2 object not found: ${row.r2_key}`)

    const buffer = await obj.arrayBuffer()
    const aiResult = await this.ai.run('@cf/openai/whisper-large-v3-turbo', {
      audio: Array.from(new Uint8Array(buffer)),
    }) as { text?: string; words?: Array<{ start: number; word: string }> }

    const transcript = (aiResult.text ?? '').trim()
    const chapters = this.buildChapters(transcript)

    const now = new Date().toISOString()
    await this.db.execute(
      `UPDATE media_assets SET transcript = ?, chapters = ?, updated_at = ? WHERE id = ?`,
      [transcript, JSON.stringify(chapters), now, id]
    )

    return { transcript, chapters }
  }

  transform(id: string, variant: string): Promise<string> {
    // Synchronous logic but MediaPort requires Promise return
    return this.get(id).then(asset => {
      if (!asset) throw new Error(`Media asset not found: ${id}`)

      const preset = VARIANT_PRESETS[variant]
      const params = preset ?? `width=auto,format=auto,quality=85`
      const url = `${this.siteUrl}/cdn-cgi/image/${params}/${asset.r2Key}`

      return url
    })
  }

  async search(query: string, tenant?: string, limit?: number): Promise<MediaAsset[]> {
    const searchLimit = Math.min(limit ?? 20, 100)
    const likePattern = `%${query}%`

    const conditions: string[] = [
      '(alt_text LIKE ? OR description LIKE ? OR tags LIKE ? OR transcript LIKE ?)',
    ]
    const params: unknown[] = [likePattern, likePattern, likePattern, likePattern]

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    params.push(searchLimit)

    const rows = await this.db.query<MediaRow>(
      `SELECT * FROM media_assets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
      params
    )

    return rows.map(rowToAsset)
  }

  async list(tenant?: string, cursor?: string, limit?: number): Promise<{ assets: MediaAsset[]; cursor?: string }> {
    const pageLimit = Math.min(limit ?? 20, 100)

    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    if (cursor) {
      conditions.push('id < ?')
      params.push(cursor)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(pageLimit)

    const rows = await this.db.query<MediaRow>(
      `SELECT * FROM media_assets ${where} ORDER BY created_at DESC LIMIT ?`,
      params
    )

    const assets = rows.map(rowToAsset)
    const nextCursor = assets.length === pageLimit ? assets[assets.length - 1].id : undefined

    return { assets, cursor: nextCursor }
  }

  async delete(id: string): Promise<void> {
    const row = await this.db.queryOne<MediaRow>(
      'SELECT r2_key FROM media_assets WHERE id = ? LIMIT 1', [id]
    )
    if (!row) return

    await this.r2.delete(row.r2_key)
    await this.db.execute('DELETE FROM media_assets WHERE id = ?', [id])
  }

  async generateImage(prompt: string, tenant?: string): Promise<MediaAsset> {
    if (!this.ai) throw new Error('AI binding required for image generation')

    const result = await this.ai.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt,
    }) as ArrayBuffer | { image?: number[] }

    let imageBuffer: ArrayBuffer
    if (result instanceof ArrayBuffer) {
      imageBuffer = result
    } else if (typeof result === 'object' && result !== null && 'image' in result && Array.isArray(result.image)) {
      imageBuffer = new Uint8Array(result.image).buffer
    } else {
      throw new Error('Unexpected AI response format for image generation')
    }

    const slug = slugFromFilename(prompt.slice(0, 60))
    const filename = `${slug || 'generated'}.png`

    const asset = await this.upload(imageBuffer, filename, 'image/png', tenant)

    // Update source_type to 'generate'
    await this.db.execute(
      `UPDATE media_assets SET source_type = ? WHERE id = ?`,
      ['generate', asset.id]
    )

    return { ...asset, sourceType: 'generate' }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async describeBuffer(buffer: ArrayBuffer): Promise<{ altText: string; description: string; tags: string[]; nsfwScore: number; thumbhash: string }> {
    if (!this.ai) {
      return { altText: '', description: '', tags: [], nsfwScore: 0, thumbhash: '' }
    }

    const result = await this.ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: Array.from(new Uint8Array(buffer)),
      prompt: 'Describe this image in detail. Provide: 1) A short alt text (one sentence). 2) A longer description (2-3 sentences). 3) Relevant tags as a comma-separated list. 4) An NSFW score from 0 to 1 (0=safe, 1=explicit). 5) The 2-3 dominant colors as hex codes (e.g. #ff5733). Format your response as JSON with keys: altText, description, tags, nsfwScore, dominantColors',
    }) as { response?: string } | string

    const responseText = typeof result === 'string' ? result : (result.response ?? '')

    try {
      // Try to parse structured JSON from the model response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          altText?: string
          description?: string
          tags?: string | string[]
          nsfwScore?: number
          dominantColors?: string[]
        }
        const tags = Array.isArray(parsed.tags)
          ? parsed.tags
          : typeof parsed.tags === 'string'
            ? parsed.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : []

        // Build thumbhash gradient from dominant colors or full response text
        const colorsSource = Array.isArray(parsed.dominantColors)
          ? parsed.dominantColors.join(' ')
          : jsonMatch[0]
        const thumbhash = extractDominantColors(colorsSource)

        return {
          altText: parsed.altText ?? '',
          description: parsed.description ?? '',
          tags,
          nsfwScore: typeof parsed.nsfwScore === 'number' ? parsed.nsfwScore : 0,
          thumbhash,
        }
      }
    } catch {
      // Fall through to plain text fallback
    }

    // Fallback: use raw response as description
    return {
      altText: responseText.slice(0, 125),
      description: responseText,
      tags: [],
      nsfwScore: 0,
      thumbhash: extractDominantColors(responseText),
    }
  }

  private buildChapters(transcript: string): Array<{ time: number; title: string }> {
    if (!transcript) return []

    // Split transcript into ~60-second segments
    // Estimate: ~150 words per minute → ~2.5 words per second → ~150 words per 60s
    const words = transcript.split(/\s+/)
    const wordsPerChapter = 150
    const chapters: Array<{ time: number; title: string }> = []

    for (let i = 0; i < words.length; i += wordsPerChapter) {
      const chapterWords = words.slice(i, i + wordsPerChapter)
      const titleWords = chapterWords.slice(0, 5).join(' ')
      const chapterIndex = Math.floor(i / wordsPerChapter)
      chapters.push({
        time: chapterIndex * 60,
        title: titleWords + (chapterWords.length > 5 ? '...' : ''),
      })
    }

    return chapters
  }
}
