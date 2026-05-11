import { describe, expect, it, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { request, seedTables } from './helpers'

const TENANT_HEADERS = { 'X-Tenant-Slug': 'acme' }
const dbCore = (env as unknown as { DB_CORE: D1Database }).DB_CORE

describe('bounty routes', () => {
  beforeEach(async () => {
    await seedTables()
    await dbCore.prepare('DELETE FROM bounties').run()
  })

  it('persists squad_id when creating a bounty', async () => {
    const res = await request('POST', '/api/bounties', {
      title: 'Fix bounty routing',
      reward_cents: 5000,
      squad_id: 'squad-alpha',
    }, TENANT_HEADERS)

    expect(res.status).toBe(201)
    const data = await res.json() as { bounty: { squad_id: string } }
    expect(data.bounty.squad_id).toBe('squad-alpha')
  })

  it('lets token-authenticated agents claim and submit a bounty', async () => {
    const now = new Date().toISOString()
    await dbCore.prepare(
      `INSERT INTO bounties
        (id, customer_slug, title, reward_cents, currency, status, creator_id, labels_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind('bounty-1', 'acme', 'Agent claim', 5000, 'USD', 'open', 'owner', '[]', now, now).run()

    const authHeaders = {
      ...TENANT_HEADERS,
      'X-Agent-Id': 'agent-42',
    }

    const claim = await request('POST', '/api/bounties/bounty-1/claim', undefined, authHeaders)
    expect(claim.status).toBe(200)
    const claimed = await claim.json() as { bounty: { claimant_id: string; agent_id: string; assignee_type: string } }
    expect(claimed.bounty.claimant_id).toBe('agent-42')
    expect(claimed.bounty.agent_id).toBe('agent-42')
    expect(claimed.bounty.assignee_type).toBe('agent')

    const submit = await request('POST', '/api/bounties/bounty-1/submit', {
      proof_url: 'https://github.com/Mumega-com/inkwell/pull/1',
    }, authHeaders)
    expect(submit.status).toBe(200)
    const submitted = await submit.json() as { bounty: { status: string; proof_url: string } }
    expect(submitted.bounty.status).toBe('submitted')
    expect(submitted.bounty.proof_url).toBe('https://github.com/Mumega-com/inkwell/pull/1')
  })
})
