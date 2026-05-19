import { describe, it, expect, beforeAll } from 'vitest'
import { request, seedTables } from './helpers'

beforeAll(async () => {
  await seedTables()
})

describe('Health endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request('GET', '/health')
    expect(res.status).toBe(200)
    const body = await res.json<{ status: string; ts: number }>()
    expect(body.status).toBe('ok')
    expect(typeof body.ts).toBe('number')
  })
})
