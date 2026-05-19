import { describe, it, expect } from 'vitest'
import type { MediaAsset, MediaPort } from '../types'

// ── Mock adapter for testing the port contract ──────────────────────────────

class MockMediaAdapter implements MediaPort {
  private assets: Map<string, MediaAsset> = new Map()

  async upload(file: ArrayBuffer, filename: string, contentType: string, tenant?: string): Promise<MediaAsset> {
    const id = `asset-${this.assets.size + 1}`
    const slug = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-')
    const asset: MediaAsset = {
      id,
      tenant,
      filename,
      contentType,
      r2Key: `media/${tenant ?? 'default'}/${id}/${filename}`,
      sizeBytes: file.byteLength,
      altText: `Alt text for ${filename}`,
      description: `Description of ${filename}`,
      tags: ['uploaded'],
      variants: {},
      graphSlug: slug,
      sourceType: 'upload',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.assets.set(id, asset)
    return asset
  }

  async get(id: string): Promise<MediaAsset | null> {
    return this.assets.get(id) ?? null
  }

  async describe(id: string): Promise<{ altText: string; description: string; tags: string[]; nsfwScore: number }> {
    const asset = this.assets.get(id)
    if (!asset) throw new Error('not found')
    return {
      altText: `AI alt text for ${asset.filename}`,
      description: `AI description of ${asset.filename}`,
      tags: ['ai-analyzed', 'photo'],
      nsfwScore: 0.01,
    }
  }

  async transcribe(id: string): Promise<{ transcript: string; chapters: Array<{ time: number; title: string }> }> {
    const asset = this.assets.get(id)
    if (!asset) throw new Error('not found')
    return {
      transcript: 'Hello world, this is a test transcription.',
      chapters: [
        { time: 0, title: 'Introduction' },
        { time: 60, title: 'Main Content' },
      ],
    }
  }

  async transform(id: string, variant: string): Promise<string> {
    const asset = this.assets.get(id)
    if (!asset) throw new Error('not found')
    const widths: Record<string, number> = { thumbnail: 200, hero: 1200, og: 1200 }
    return `https://example.com/cdn-cgi/image/width=${widths[variant] ?? 800},format=auto/${asset.r2Key}`
  }

  async search(query: string, tenant?: string, limit?: number): Promise<MediaAsset[]> {
    const results: MediaAsset[] = []
    for (const asset of this.assets.values()) {
      if (tenant && asset.tenant !== tenant) continue
      const searchable = `${asset.altText} ${asset.description} ${asset.tags.join(' ')}`
      if (searchable.toLowerCase().includes(query.toLowerCase())) {
        results.push(asset)
      }
      if (results.length >= (limit ?? 10)) break
    }
    return results
  }

  async list(tenant?: string, _cursor?: string, limit?: number): Promise<{ assets: MediaAsset[]; cursor?: string }> {
    const all = [...this.assets.values()]
      .filter(a => !tenant || a.tenant === tenant)
      .slice(0, limit ?? 20)
    return { assets: all }
  }

  async delete(id: string): Promise<void> {
    this.assets.delete(id)
  }

  async generateImage(prompt: string, tenant?: string): Promise<MediaAsset> {
    const fakeImage = new ArrayBuffer(1024)
    const filename = `generated-${Date.now()}.png`
    const asset = await this.upload(fakeImage, filename, 'image/png', tenant)
    asset.sourceType = 'generate'
    asset.description = prompt
    return asset
  }
}

describe('MediaPort contract', () => {
  it('upload stores an asset and returns metadata', async () => {
    const media = new MockMediaAdapter()
    const file = new ArrayBuffer(256)
    const asset = await media.upload(file, 'test-image.jpg', 'image/jpeg', 'tenant1')

    expect(asset.id).toBeTruthy()
    expect(asset.filename).toBe('test-image.jpg')
    expect(asset.contentType).toBe('image/jpeg')
    expect(asset.sizeBytes).toBe(256)
    expect(asset.tenant).toBe('tenant1')
    expect(asset.r2Key).toContain('media/tenant1/')
    expect(asset.sourceType).toBe('upload')
    expect(asset.graphSlug).toBe('test-image')
  })

  it('get retrieves an uploaded asset', async () => {
    const media = new MockMediaAdapter()
    const file = new ArrayBuffer(128)
    const uploaded = await media.upload(file, 'photo.png', 'image/png')

    const retrieved = await media.get(uploaded.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.filename).toBe('photo.png')
  })

  it('get returns null for unknown id', async () => {
    const media = new MockMediaAdapter()
    const result = await media.get('nonexistent')
    expect(result).toBeNull()
  })

  it('describe returns AI analysis', async () => {
    const media = new MockMediaAdapter()
    const file = new ArrayBuffer(64)
    const asset = await media.upload(file, 'hero.jpg', 'image/jpeg')

    const analysis = await media.describe(asset.id)
    expect(analysis.altText).toBeTruthy()
    expect(analysis.description).toBeTruthy()
    expect(analysis.tags).toBeInstanceOf(Array)
    expect(analysis.tags.length).toBeGreaterThan(0)
    expect(typeof analysis.nsfwScore).toBe('number')
    expect(analysis.nsfwScore).toBeLessThan(1)
  })

  it('transcribe returns transcript and chapters', async () => {
    const media = new MockMediaAdapter()
    const file = new ArrayBuffer(1024)
    const asset = await media.upload(file, 'video.mp4', 'video/mp4')

    const result = await media.transcribe(asset.id)
    expect(result.transcript).toBeTruthy()
    expect(result.chapters).toBeInstanceOf(Array)
    expect(result.chapters.length).toBeGreaterThan(0)
    expect(result.chapters[0].time).toBe(0)
    expect(result.chapters[0].title).toBeTruthy()
  })

  it('transform returns variant URL', async () => {
    const media = new MockMediaAdapter()
    const file = new ArrayBuffer(64)
    const asset = await media.upload(file, 'banner.jpg', 'image/jpeg')

    const thumbUrl = await media.transform(asset.id, 'thumbnail')
    expect(thumbUrl).toContain('width=200')
    expect(thumbUrl).toContain('format=auto')

    const heroUrl = await media.transform(asset.id, 'hero')
    expect(heroUrl).toContain('width=1200')
  })

  it('search finds assets by query', async () => {
    const media = new MockMediaAdapter()
    await media.upload(new ArrayBuffer(64), 'sunset.jpg', 'image/jpeg', 'demo')
    await media.upload(new ArrayBuffer(64), 'code.png', 'image/png', 'demo')

    const results = await media.search('sunset', 'demo')
    expect(results.length).toBe(1)
    expect(results[0].filename).toBe('sunset.jpg')
  })

  it('list returns assets with pagination shape', async () => {
    const media = new MockMediaAdapter()
    await media.upload(new ArrayBuffer(64), 'a.jpg', 'image/jpeg', 't1')
    await media.upload(new ArrayBuffer(64), 'b.jpg', 'image/jpeg', 't1')
    await media.upload(new ArrayBuffer(64), 'c.jpg', 'image/jpeg', 't2')

    const result = await media.list('t1')
    expect(result.assets.length).toBe(2)
    expect(result.assets.every(a => a.tenant === 't1')).toBe(true)
  })

  it('delete removes an asset', async () => {
    const media = new MockMediaAdapter()
    const asset = await media.upload(new ArrayBuffer(64), 'temp.jpg', 'image/jpeg')
    expect(await media.get(asset.id)).not.toBeNull()

    await media.delete(asset.id)
    expect(await media.get(asset.id)).toBeNull()
  })

  it('generateImage creates an asset with sourceType generate', async () => {
    const media = new MockMediaAdapter()
    const asset = await media.generateImage('A golden sunset over mountains')

    expect(asset.id).toBeTruthy()
    expect(asset.sourceType).toBe('generate')
    expect(asset.contentType).toBe('image/png')
    expect(asset.description).toBe('A golden sunset over mountains')
  })

  it('assets have required fields', async () => {
    const media = new MockMediaAdapter()
    const asset = await media.upload(new ArrayBuffer(32), 'check.jpg', 'image/jpeg')

    expect(asset.id).toBeTruthy()
    expect(asset.filename).toBeTruthy()
    expect(asset.contentType).toBeTruthy()
    expect(asset.r2Key).toBeTruthy()
    expect(typeof asset.sizeBytes).toBe('number')
    expect(asset.tags).toBeInstanceOf(Array)
    expect(asset.variants).toBeDefined()
    expect(asset.sourceType).toBeTruthy()
    expect(asset.createdAt).toBeTruthy()
    expect(asset.updatedAt).toBeTruthy()
  })
})
