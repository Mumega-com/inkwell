import { describe, it, expect, beforeAll } from 'vitest'
import { request, seedTables } from './helpers'

describe('Analytics routes', () => {
  beforeAll(async () => {
    await seedTables()
  })

  describe('POST /api/view', () => {
    it('records a page view and returns ok', async () => {
      const res = await request('POST', '/api/view', { slug: 'hello-world' })
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean }>()
      expect(body.ok).toBe(true)
    })

    it('returns 400 without slug', async () => {
      const res = await request('POST', '/api/view', {})
      expect(res.status).toBe(400)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('slug required')
    })
  })

  describe('POST /api/reaction', () => {
    it('records a reaction and returns counts', async () => {
      const res = await request('POST', '/api/reaction', {
        slug: 'hello-world',
        emoji: 'heart',
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean; counts: Record<string, number> }>()
      expect(body.ok).toBe(true)
      expect(body.counts.heart).toBeGreaterThanOrEqual(1)
    })

    it('returns 400 without emoji', async () => {
      const res = await request('POST', '/api/reaction', { slug: 'hello-world' })
      expect(res.status).toBe(400)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('slug and emoji required')
    })
  })

  describe('GET /api/reactions/:slug', () => {
    it('returns reaction counts for a slug', async () => {
      // Seed a reaction first
      await request('POST', '/api/reaction', { slug: 'reaction-test', emoji: 'fire' })

      const res = await request('GET', '/api/reactions/reaction-test')
      expect(res.status).toBe(200)
      const body = await res.json<{ counts: Record<string, number> }>()
      expect(body.counts.fire).toBeGreaterThanOrEqual(1)
    })
  })

  describe('POST /api/subscribe', () => {
    it('adds a subscriber', async () => {
      const res = await request('POST', '/api/subscribe', {
        email: 'test@example.com',
        name: 'Test User',
        source: 'vitest',
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean; status: string }>()
      expect(body.ok).toBe(true)
      expect(body.status).toBe('subscribed')
    })

    it('returns 400 without email', async () => {
      const res = await request('POST', '/api/subscribe', { name: 'No Email' })
      expect(res.status).toBe(400)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('email required')
    })
  })

  describe('POST /api/feedback', () => {
    it('records feedback and returns ok', async () => {
      const res = await request('POST', '/api/feedback', {
        slug: 'hello-world',
        type: 'positive',
        text: 'Great article!',
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean }>()
      expect(body.ok).toBe(true)
    })

    it('returns 400 without type', async () => {
      const res = await request('POST', '/api/feedback', { slug: 'hello-world' })
      expect(res.status).toBe(400)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('slug and type required')
    })
  })

  describe('GET /api/stats/:slug', () => {
    it('returns view count and reactions', async () => {
      // Seed data
      await request('POST', '/api/view', { slug: 'stats-test' })
      await request('POST', '/api/reaction', { slug: 'stats-test', emoji: 'thumbsup' })

      const res = await request('GET', '/api/stats/stats-test')
      expect(res.status).toBe(200)
      const body = await res.json<{
        slug: string
        views: number
        reactions: Record<string, number>
      }>()
      expect(body.slug).toBe('stats-test')
      expect(body.views).toBeGreaterThanOrEqual(1)
      expect(body.reactions.thumbsup).toBeGreaterThanOrEqual(1)
    })
  })
})
