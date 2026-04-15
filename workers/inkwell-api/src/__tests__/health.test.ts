import { describe, it, expect } from 'vitest'
import { request } from './helpers'

describe('Health endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request('GET', '/health')
    expect(res.status).toBe(200)
    const body = await res.json<{ status: string; ts: number }>()
    expect(body.status).toBe('ok')
    expect(typeof body.ts).toBe('number')
  })
})
