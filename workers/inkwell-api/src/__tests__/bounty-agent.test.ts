import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { bountyRoutes } from '../../../../plugins/bounty/routes'

const app = new Hono<AppBindings>()
app.route('/api/bounties', bountyRoutes)
const testEnv = env as unknown as AppBindings['Bindings']

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return app.fetch(new Request(`http://acme.mumega.com${path}`, init), testEnv)
}

async function seedBountyTables(): Promise<void> {
  await testEnv.DB_CORE.prepare(
    `CREATE TABLE IF NOT EXISTS bounties (
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
      assignee_type TEXT NOT NULL DEFAULT 'user',
      proof_url TEXT,
      squad_id TEXT,
      labels_json TEXT DEFAULT '[]',
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await testEnv.DB_CORE.prepare('ALTER TABLE bounties ADD COLUMN agent_id TEXT').run().catch(() => {})
  await testEnv.DB_CORE.prepare("ALTER TABLE bounties ADD COLUMN assignee_type TEXT NOT NULL DEFAULT 'user'").run().catch(() => {})

  await testEnv.DB_CORE.prepare(
    `CREATE TABLE IF NOT EXISTS mcp_tokens (
      token TEXT PRIMARY KEY,
      tenant_slug TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'default',
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      revoked_at TEXT
    )`,
  ).run()

  await testEnv.DB_CORE.prepare('DELETE FROM bounties WHERE customer_slug = ?').bind('acme').run()
  await testEnv.DB_CORE.prepare('DELETE FROM mcp_tokens WHERE tenant_slug = ?').bind('acme').run()
  await testEnv.DB_CORE.prepare(
    'INSERT INTO mcp_tokens (token, tenant_slug, label, role) VALUES (?, ?, ?, ?)',
  ).bind('agent-token', 'acme', 'agent-alpha', 'admin').run()
}

describe('bounty agent claiming', () => {
  beforeEach(async () => {
    await seedBountyTables()
  })

  it('persists squad_id when creating a bounty', async () => {
    const res = await request('POST', '/api/bounties', {
      title: 'Fix squad routing',
      reward_cents: 5000,
      squad_id: 'squad-alpha',
    }, { Authorization: 'Bearer agent-token' })

    expect(res.status).toBe(201)
    const body = await res.json<{ bounty: { squad_id: string | null; creator_id: string } }>()

    expect(body.bounty.squad_id).toBe('squad-alpha')
    expect(body.bounty.creator_id).toBe('agent-alpha')
  })

  it('allows an MCP token agent to claim and submit a bounty', async () => {
    const now = new Date().toISOString()
    await testEnv.DB_CORE.prepare(
      `INSERT INTO bounties
        (id, customer_slug, title, reward_cents, currency, status, creator_id, labels_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind('bounty-claim', 'acme', 'Agent claim test', 1200, 'USD', 'open', 'owner-1', '[]', now, now).run()

    const claimRes = await request('POST', '/api/bounties/bounty-claim/claim', {
      agent_id: 'builder-1',
    }, { Authorization: 'Bearer agent-token' })

    expect(claimRes.status).toBe(200)
    const claimBody = await claimRes.json<{
      bounty: { status: string; claimant_id: string | null; agent_id: string | null; assignee_type: string }
    }>()

    expect(claimBody.bounty.status).toBe('claimed')
    expect(claimBody.bounty.claimant_id).toBe('builder-1')
    expect(claimBody.bounty.agent_id).toBe('builder-1')
    expect(claimBody.bounty.assignee_type).toBe('agent')

    const submitRes = await request('POST', '/api/bounties/bounty-claim/submit', {
      proof_url: 'https://github.com/Mumega-com/inkwell/pull/123',
    }, {
      Authorization: 'Bearer agent-token',
      'X-Agent-Id': 'builder-1',
    })

    expect(submitRes.status).toBe(200)
    const submitBody = await submitRes.json<{ bounty: { status: string; proof_url: string | null } }>()

    expect(submitBody.bounty.status).toBe('submitted')
    expect(submitBody.bounty.proof_url).toBe('https://github.com/Mumega-com/inkwell/pull/123')
  })
})
