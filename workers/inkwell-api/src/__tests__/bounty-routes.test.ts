import { describe, it, expect, beforeAll } from 'vitest'
import { env, exports } from 'cloudflare:workers'

import { seedTables } from './helpers'

const BASE = 'http://acme.mumega.com'
const USER_TOKEN = 'bounty-user-session-token'
const AGENT_TOKEN = 'dev-inkwell-local-test-token-do-not-use-in-prod'

async function request(
  method: string,
  path: string,
  body?: unknown,
  token = USER_TOKEN,
): Promise<Response> {
  return exports.default.fetch(new Request(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Host': 'acme.mumega.com',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

async function createBounty(title: string, squadId?: string): Promise<Record<string, unknown>> {
  const res = await request('POST', '/api/bounties', {
    title,
    description: 'Vitest bounty',
    reward_cents: 5000,
    currency: 'USD',
    squad_id: squadId,
    labels: ['vitest'],
  })
  if (res.status !== 201) {
    throw new Error(`Expected 201 creating bounty, got ${res.status}: ${await res.text()}`)
  }
  const body = await res.json<{ bounty: Record<string, unknown> }>()
  return body.bounty
}

describe('bounty routes', () => {
  beforeAll(async () => {
    ;(env as Record<string, unknown>)['SOS_SAAS_URL'] = ''
    ;(env as Record<string, unknown>)['PUBLISH_TOKEN'] = AGENT_TOKEN

    await seedTables()
    await env.DB_ANALYTICS.prepare(
      `CREATE TABLE IF NOT EXISTS api_usage (
        tenant_slug TEXT NOT NULL,
        date TEXT NOT NULL,
        call_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_slug, date)
      )`,
    ).run()

    await env.DB_CORE.prepare('DROP TABLE IF EXISTS bounties').run()
    await env.DB_CORE.prepare(
      `CREATE TABLE bounties (
        id TEXT PRIMARY KEY,
        customer_slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        reward_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'open',
        creator_id TEXT NOT NULL,
        claimant_id TEXT,
        agent_id TEXT,
        assignee_type TEXT,
        proof_url TEXT,
        squad_id TEXT,
        labels_json TEXT DEFAULT '[]',
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ).run()

    await env.SESSIONS.put(`session:${USER_TOKEN}`, JSON.stringify({
      id: 'session-bounty-user',
      customerSlug: 'acme',
      identityId: 'user-manager',
      portalAccountId: 'acct-manager',
      channel: 'email',
      contactValue: 'manager@example.com',
      contactNormalized: 'manager@example.com',
      fullName: 'Manager User',
      role: 'manager',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }), { expirationTtl: 3600 })
  })

  it('persists squad_id when creating a bounty', async () => {
    const bounty = await createBounty('Squad scoped bounty', 'squad-alpha')

    expect(bounty.customer_slug).toBe('acme')
    expect(bounty.squad_id).toBe('squad-alpha')
    expect(bounty.status).toBe('open')
  })

  it('lets a trusted agent token claim and submit an agent bounty', async () => {
    const bounty = await createBounty('Agent claim bounty', 'squad-beta')
    const id = bounty.id as string

    const claimRes = await request('POST', `/api/bounties/${id}/claim`, {
      agent_id: 'agent-seo-1',
    }, AGENT_TOKEN)
    expect(claimRes.status).toBe(200)
    const claimed = await claimRes.json<{ bounty: Record<string, unknown> }>()
    expect(claimed.bounty.status).toBe('claimed')
    expect(claimed.bounty.claimant_id).toBe('agent-seo-1')
    expect(claimed.bounty.agent_id).toBe('agent-seo-1')
    expect(claimed.bounty.assignee_type).toBe('agent')

    const submitRes = await request('POST', `/api/bounties/${id}/submit`, {
      agent_id: 'agent-seo-1',
      proof_url: 'https://example.com/proof',
    }, AGENT_TOKEN)
    expect(submitRes.status).toBe(200)
    const submitted = await submitRes.json<{ bounty: Record<string, unknown> }>()
    expect(submitted.bounty.status).toBe('submitted')
    expect(submitted.bounty.proof_url).toBe('https://example.com/proof')
  })

  it('rejects agent claims without the trusted token', async () => {
    const bounty = await createBounty('Rejected agent claim bounty')
    const id = bounty.id as string

    const res = await request('POST', `/api/bounties/${id}/claim`, {
      agent_id: 'agent-no-token',
    }, 'wrong-token')

    expect(res.status).toBe(401)
    const body = await res.json<{ error?: string }>()
    expect(body.error).toBe('unauthorized')
  })
})
