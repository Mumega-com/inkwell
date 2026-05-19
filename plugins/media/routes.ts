import { Hono } from 'hono'
import { requireAuth } from '../middleware'
import type { AppBindings } from '../types'

const mediaRoutes = new Hono<AppBindings>()

// POST /api/media/upload — multipart form upload
mediaRoutes.post('/upload', requireAuth, async (c) => {
  const form = await c.req.formData()
  const file = form.get('file') as File
  if (!file) {
    return c.json({ error: 'No file provided' }, 400)
  }

  const tenant = c.get('tenant_slug') ?? undefined
  const media = c.get('media')
  const asset = await media.upload(await file.arrayBuffer(), file.name, file.type, tenant)

  const graph = c.get('graph')
  if (graph && asset.graphSlug) {
    try {
      await graph.upsertNode({
        slug: `media/${asset.graphSlug}`,
        title: asset.altText || asset.filename,
        type: 'media',
        tags: asset.tags,
        tenant: asset.tenant,
        visibility: 'public',
        author: 'system',
        date: asset.createdAt.slice(0, 10),
      })
    } catch {
      // Graph upsert is non-critical — don't fail the upload
    }
  }

  return c.json(asset)
})

// GET /api/media/:id — get asset metadata
mediaRoutes.get('/:id', requireAuth, async (c) => {
  const asset = await c.get('media').get(c.req.param('id'))
  if (!asset) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json(asset)
})

// GET /api/media — list/search assets
mediaRoutes.get('/', requireAuth, async (c) => {
  const q = c.req.query('q')
  const cursor = c.req.query('cursor')
  const limit = Number(c.req.query('limit')) || 20
  const tenant = c.get('tenant_slug') ?? undefined
  const media = c.get('media')

  if (q) {
    const assets = await media.search(q, tenant, limit)
    return c.json({ assets })
  }

  const result = await media.list(tenant, cursor, limit)
  return c.json(result)
})

// POST /api/media/:id/describe — re-run AI analysis
mediaRoutes.post('/:id/describe', requireAuth, async (c) => {
  const result = await c.get('media').describe(c.req.param('id'))
  return c.json(result)
})

// POST /api/media/:id/transcribe — transcribe video/audio
mediaRoutes.post('/:id/transcribe', requireAuth, async (c) => {
  const result = await c.get('media').transcribe(c.req.param('id'))
  return c.json(result)
})

// GET /api/media/:id/transform/:variant — get transform URL
mediaRoutes.get('/:id/transform/:variant', requireAuth, async (c) => {
  const url = await c.get('media').transform(c.req.param('id'), c.req.param('variant'))
  return c.json({ url })
})

// DELETE /api/media/:id — delete asset (admin only)
mediaRoutes.delete('/:id', requireAuth, async (c) => {
  await c.get('media').delete(c.req.param('id'))
  return c.json({ deleted: true })
})

// GET /api/media/:id/captions.vtt — WebVTT captions from transcript (no auth — served to video player)
mediaRoutes.get('/:id/captions.vtt', async (c) => {
  const asset = await c.get('media').get(c.req.param('id'))
  if (!asset || !asset.transcript) {
    return c.text('', 404)
  }

  const cues: Array<{ start: number; end: number; text: string }> = []

  if (asset.chapters && asset.chapters.length > 0) {
    // Use chapters as cue boundaries
    for (let i = 0; i < asset.chapters.length; i++) {
      const start = asset.chapters[i].time
      const end = i + 1 < asset.chapters.length ? asset.chapters[i + 1].time : start + 60
      // Split transcript proportionally by chapter count
      const words = asset.transcript.split(/\s+/)
      const wordsPerChapter = Math.ceil(words.length / asset.chapters.length)
      const chapterWords = words.slice(i * wordsPerChapter, (i + 1) * wordsPerChapter)
      if (chapterWords.length > 0) {
        cues.push({ start, end, text: chapterWords.join(' ') })
      }
    }
  } else {
    // No chapters — split transcript into ~30-second cues (~75 words each)
    const words = asset.transcript.split(/\s+/)
    const wordsPerCue = 75
    let timeOffset = 0
    const cueDuration = 30

    for (let i = 0; i < words.length; i += wordsPerCue) {
      const chunk = words.slice(i, i + wordsPerCue)
      cues.push({
        start: timeOffset,
        end: timeOffset + cueDuration,
        text: chunk.join(' '),
      })
      timeOffset += cueDuration
    }
  }

  const vtt = ['WEBVTT', '']
    .concat(
      cues.map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`)
    )
    .join('\n\n')

  return new Response(vtt, {
    headers: {
      'Content-Type': 'text/vtt',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

// POST /api/media/generate — generate image from prompt
mediaRoutes.post('/generate', requireAuth, async (c) => {
  const body = await c.req.json<{ prompt: string; tenant?: string }>()
  const tenant = body.tenant ?? c.get('tenant_slug') ?? undefined
  const media = c.get('media')
  const asset = await media.generateImage(body.prompt, tenant)

  const graph = c.get('graph')
  if (graph && asset.graphSlug) {
    try {
      await graph.upsertNode({
        slug: `media/${asset.graphSlug}`,
        title: asset.altText || asset.filename,
        type: 'media',
        tags: asset.tags,
        tenant: asset.tenant,
        visibility: 'public',
        author: 'system',
        date: asset.createdAt.slice(0, 10),
      })
    } catch {
      // Graph upsert is non-critical — don't fail the generation
    }
  }

  return c.json(asset)
})

/** Format seconds to VTT timestamp: HH:MM:SS.000 */
function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export { mediaRoutes }
