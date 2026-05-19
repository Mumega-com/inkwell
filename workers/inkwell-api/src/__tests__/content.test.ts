import { describe, it, expect, beforeAll } from 'vitest'
import { request, seedTables } from './helpers'

describe('Content routes', () => {
  beforeAll(async () => {
    await seedTables()
  })

  const validPayload = {
    title: 'Test Post Title',
    content: 'This is the body of the test post with enough content.',
    author: 'tester',
  }

  describe('POST /api/publish', () => {
    it('creates content and returns ok with slug', async () => {
      const res = await request('POST', '/api/publish', validPayload)
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean; slug: string }>()
      expect(body.ok).toBe(true)
      expect(body.slug).toBe('test-post-title')
    })

    it('returns 400 without title', async () => {
      const res = await request('POST', '/api/publish', {
        content: 'body text',
        author: 'tester',
      })
      expect(res.status).toBe(400)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('title required')
    })

    it('returns 413 when content exceeds 200KB', async () => {
      const largeContent = 'x'.repeat(200_001)
      const res = await request('POST', '/api/publish', {
        title: 'Large Post',
        content: largeContent,
        author: 'tester',
      })
      expect(res.status).toBe(413)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('content too large')
    })

    it('returns 409 for duplicate slug', async () => {
      // First post already created with slug "test-post-title" above.
      // Create another with the same title to trigger conflict.
      const res = await request('POST', '/api/publish', {
        title: 'Test Post Title',
        content: 'Different body content.',
        author: 'tester',
      })
      expect(res.status).toBe(409)
      const body = await res.json<{ error: string; slug: string }>()
      expect(body.error).toBe('slug_exists')
      expect(body.slug).toBe('test-post-title')
    })

    it('replaces existing content when overwrite is true', async () => {
      const res = await request('POST', '/api/publish', {
        title: 'Test Post Title',
        content: 'Overwritten body content.',
        author: 'tester',
        overwrite: true,
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ ok: boolean; slug: string }>()
      expect(body.ok).toBe(true)
      expect(body.slug).toBe('test-post-title')
    })
  })

  describe('GET /api/posts', () => {
    it('returns a list of posts (excluding drafts)', async () => {
      const res = await request('GET', '/api/posts')
      expect(res.status).toBe(200)
      const body = await res.json<{ posts: unknown[] }>()
      expect(Array.isArray(body.posts)).toBe(true)
      // The published post from above should be in the list
      expect(body.posts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /api/posts/:slug', () => {
    it('returns content for an existing slug', async () => {
      const res = await request('GET', '/api/posts/test-post-title')
      expect(res.status).toBe(200)
      const body = await res.json<{ slug: string; markdown: string }>()
      expect(body.slug).toBe('test-post-title')
      expect(body.markdown).toContain('Overwritten body content.')
    })

    it('returns 404 for a nonexistent slug', async () => {
      const res = await request('GET', '/api/posts/does-not-exist')
      expect(res.status).toBe(404)
      const body = await res.json<{ error: string }>()
      expect(body.error).toBe('not found')
    })
  })
})
