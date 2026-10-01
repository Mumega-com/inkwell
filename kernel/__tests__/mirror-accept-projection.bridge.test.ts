import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { StandaloneMemoryAdapter } from '../adapters/standalone-memory'
import {
  authorPage,
  ensureAuthoredSchema,
  lookupPage,
  projectRevision,
  readAudit,
  resolveScope,
  withdrawPage,
  type ProjectionBody,
} from '../scoped-authored'
import type { DatabasePort } from '../types'

const ALPHA_BODY = 'What Mirror is, written in Alpha. ALPHA-BRIDGE-BODY'
const FAILED_BODY = 'This projection must stay failed. FAILED-BRIDGE-BODY'

function openDb(path: string): DatabasePort & { close(): void } {
  const sqlite = new DatabaseSync(path)
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...(params as never[])) as T[]
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return (sqlite.prepare(sql).get(...(params as never[])) as T | undefined) ?? null
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = sqlite.prepare(sql).run(...(params as never[]))
      return { changes: Number(result.changes) }
    },
    async batch(statements) {
      for (const statement of statements) await this.execute(statement.sql, statement.params)
    },
    close() {
      sqlite.close()
    },
  }
}

function mirrorRepo(): string {
  const candidates = [
    process.env.MIRROR_REPO,
    '/Users/hadi/dev/worktrees/mirror-scoped-memory-362d',
  ].filter((value): value is string => Boolean(value))
  const found = candidates.find(path => existsSync(join(path, 'kernel/scoped_memory.py')))
  if (!found) throw new Error('MIRROR_REPO must point at the scoped Mirror checkout')
  return found
}

function mirrorPython(): string {
  const candidates = [
    process.env.MIRROR_PYTHON,
    '/Users/hadi/dev/mumega/mirror/.worktrees/local-memory-pilot/venv/bin/python',
  ].filter((value): value is string => Boolean(value))
  return candidates.find(path => existsSync(path)) ?? 'python3'
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('no port'))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

const SERVER = String.raw`
import os, sys
os.environ["MIRROR_BACKEND"] = "sqlite"
os.environ["MIRROR_SQLITE_PATH"] = sys.argv[1]
os.environ["MIRROR_VECTOR_DIMS"] = "32"
os.environ["MIRROR_EMBED_PROVIDER"] = "local"
os.environ["MIRROR_TENANT_KEYS_PATH"] = sys.argv[2]
os.environ["MIRROR_ADMIN_TOKEN"] = "not-a-synthetic-token"
os.environ.pop("MIRROR_RECEIPT_WRITER_TOKEN", None)
os.environ.pop("INKWELL_RECEIPT_TOKEN", None)
os.environ.pop("INKWELL_RECEIPTS_URL", None)
os.environ.pop("OPENAI_API_KEY", None)
sys.path.insert(0, sys.argv[3])

from kernel.db import get_db
from kernel.scoped_memory import grant_project

database = get_db()
grant_project(database, tenant_id="tenant-synth", project_id="alpha", principal_id="ada", can_read_private=True)
grant_project(database, tenant_id="tenant-synth", project_id="beta", principal_id="bea", can_read_private=True)

import uvicorn
from fastapi import FastAPI
from plugins.memory.routes import router

app = FastAPI()
app.include_router(router)
print("MIRROR_BRIDGE_READY", flush=True)
uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[4]), log_level="warning")
`

const REOPEN = String.raw`
import json, os, sys
os.environ["MIRROR_EMBED_PROVIDER"] = "local"
os.environ.pop("OPENAI_API_KEY", None)
sys.path.insert(0, sys.argv[1])

from kernel.auth import TokenContext
from kernel.db_sqlite import SQLiteDB
from kernel.scoped_memory import lookup_engram, read_audit, scoped_count, scoped_search, withdraw_engram

database = SQLiteDB(sys.argv[2], dims=32)
ada = TokenContext(
    workspace_id="tenant-synth", owner_type="principal", owner_id="ada",
    project_id="alpha", principal_id="ada",
)
bea = TokenContext(
    workspace_id="tenant-synth", owner_type="principal", owner_id="bea",
    project_id="beta", principal_id="bea",
)
alpha = lookup_engram(database, ada, "what-mirror-is")
beta = lookup_engram(database, bea, "what-mirror-is")
beta_search = scoped_search(database, bea, "ALPHA-BRIDGE-BODY", limit=5)
failed = lookup_engram(database, ada, "projection-miss")
before = {
    "alpha": alpha,
    "beta": beta,
    "beta_search": beta_search,
    "beta_count": scoped_count(database, bea),
    "alpha_count": scoped_count(database, ada),
    "failed": failed,
}
withdrawn = withdraw_engram(database, ada, "what-mirror-is")
after = lookup_engram(database, ada, "what-mirror-is")
audit = read_audit(database, ada, "what-mirror-is")
print(json.dumps({"before": before, "withdrawn": withdrawn, "after": after, "audit": audit}, default=str))
`

function runPython(python: string, script: string, args: string[], repo: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(python, ['-c', script, ...args], {
      cwd: repo,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        LANG: 'C',
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

async function startMirror(python: string, repo: string, dbPath: string, keysPath: string, port: number): Promise<{ child: ChildProcess; log: () => string }> {
  const child = spawn(python, ['-c', SERVER, dbPath, keysPath, repo, String(port)], {
    cwd: repo,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      LANG: 'C',
    },
  })
  let output = ''
  child.stdout.on('data', chunk => { output += String(chunk) })
  child.stderr.on('data', chunk => { output += String(chunk) })
  const started = Date.now()
  while (!output.includes('MIRROR_BRIDGE_READY')) {
    if (child.exitCode !== null) throw new Error(`Mirror exited early\n${output}`)
    if (Date.now() - started > 15000) throw new Error(`Mirror did not start\n${output}`)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  const startedHttp = Date.now()
  while (Date.now() - startedHttp < 10000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/lookup/ready`, {
        headers: { Authorization: 'Bearer synth-alpha-token' },
      })
      if (response.status === 404 || response.status === 200 || response.status === 403) {
        return { child, log: () => output }
      }
    } catch {
      // The process has printed ready before the socket accepts.
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Mirror port did not accept connections\n${output}`)
}

async function stopMirror(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  const started = Date.now()
  while (child.exitCode === null && Date.now() - started < 3000) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (child.exitCode === null) child.kill('SIGKILL')
}

function mirrorSink(base: string, token: string) {
  return {
    async accept(body: ProjectionBody) {
      const response = await fetch(`${base}/store`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: 'caller-chosen-agent',
          context_id: body.slug,
          text: body.text,
          project: 'beta',
          metadata: {
            revision: body.revision,
            visibility: body.visibility,
            title: body.title,
            content_hash: body.contentHash,
            idempotency_key: body.idempotencyKey,
            tenant: 'caller-tenant',
            approved: true,
          },
        }),
      })
      const payload = await response.json() as {
        status?: string
        receipt_id?: string
        approved?: boolean
        detail?: string
        receipt?: { action_type?: string; output?: { approved?: boolean }; source_id?: string }
      }
      if (!response.ok || payload.status === 'failed') {
        throw new Error(payload.detail || payload.status || `mirror_${response.status}`)
      }
      if (payload.approved !== false) throw new Error('projection was treated as an approval')
      if (payload.receipt?.action_type !== 'mirror.engram.write') throw new Error('receipt was not Mirror\'s write receipt')
      if (payload.receipt.output?.approved !== false) throw new Error('receipt marked the write approved')
      if (!payload.receipt_id) throw new Error('missing receipt')
      return { receiptId: payload.receipt_id, status: 'accepted' as const }
    },
  }
}

describe('Inkwell page to Mirror accept_projection', () => {
  it('projects through the real store route, reopens both stores, and hides the other project', async () => {
    const repo = mirrorRepo()
    const python = mirrorPython()
    const dir = mkdtempSync(join(tmpdir(), 'inkwell-mirror-bridge-'))
    const pagePath = join(dir, 'pages.sqlite')
    const mirrorPath = join(dir, 'mirror.sqlite')
    const keysPath = join(dir, 'tenant-keys.json')
    writeFileSync(keysPath, JSON.stringify([
      { key: 'synth-alpha-token', active: true, agent_slug: 'ada', workspace_id: 'tenant-synth', project_id: 'alpha', principal_id: 'ada' },
      { key: 'synth-beta-token', active: true, agent_slug: 'bea', workspace_id: 'tenant-synth', project_id: 'beta', principal_id: 'bea' },
      { key: 'synth-ungranted-token', active: true, agent_slug: 'cy', workspace_id: 'tenant-synth', project_id: 'alpha', principal_id: 'cy' },
    ]))
    const port = await freePort()
    const bridge = await startMirror(python, repo, mirrorPath, keysPath, port)
    const base = `http://127.0.0.1:${port}`
    const map = new StandaloneMemoryAdapter()
    try {
      const db = openDb(pagePath)
      await ensureAuthoredSchema(db)
      const ada = await resolveScope(db, { tenantId: 'tenant-synth', projectId: 'alpha', principalId: 'ada', role: 'owner' })
      await authorPage(db, ada, {
        slug: 'what-mirror-is',
        title: 'What Mirror is',
        body: ALPHA_BODY,
        visibility: 'public',
        project: 'beta',
        agent: 'bea',
        approved: true,
      })
      const projected = await projectRevision(db, ada, 'what-mirror-is', mirrorSink(base, 'synth-alpha-token'))
      expect(projected.status).toBe('accepted')
      expect(projected.approved).toBe(false)
      expect(projected.receiptId).toMatch(/^[0-9a-f-]{36}$/)

      await authorPage(db, ada, {
        slug: 'projection-miss',
        title: 'Miss',
        body: FAILED_BODY,
        visibility: 'private',
      })
      const failed = await projectRevision(db, ada, 'projection-miss', mirrorSink(base, 'synth-ungranted-token'))
      expect(failed.status).toBe('failed')
      expect(failed.approved).toBe(false)

      const alphaLookup = await fetch(`${base}/lookup/what-mirror-is`, { headers: { Authorization: 'Bearer synth-alpha-token' } })
      const alphaRow = await alphaLookup.json() as { text?: string }
      expect(alphaLookup.status).toBe(200)
      expect(alphaRow.text).toBe(ALPHA_BODY)

      const betaLookup = await fetch(`${base}/lookup/what-mirror-is`, {
        headers: { Authorization: 'Bearer synth-beta-token', 'X-Project-Context': 'alpha' },
      })
      const betaBody = await betaLookup.text()
      expect(betaLookup.status).toBe(404)
      expect(betaBody).not.toContain('ALPHA-BRIDGE-BODY')
      expect(betaBody).not.toContain('What Mirror is')

      const betaSearch = await fetch(`${base}/search`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer synth-beta-token',
          'Content-Type': 'application/json',
          'X-Project-Context': 'alpha',
        },
        body: JSON.stringify({ query: 'ALPHA-BRIDGE-BODY', top_k: 5, threshold: 0, project: 'alpha' }),
      })
      const betaSearchBody = await betaSearch.text()
      expect(betaSearch.status).toBe(200)
      expect(betaSearchBody).not.toContain('ALPHA-BRIDGE-BODY')
      expect(JSON.parse(betaSearchBody)).toEqual([])

      db.close()
      const reopenedPages = openDb(pagePath)
      const page = await lookupPage(reopenedPages, ada, 'what-mirror-is')
      expect(page?.body).toBe(ALPHA_BODY)
      expect(page?.revision).toBe(1)
      const stored = await reopenedPages.queryOne<{ projection_status: string; receipt_id: string; accepted_revision: number }>(
        `SELECT projection_status, receipt_id, accepted_revision FROM authored_pages WHERE slug = ? AND project_id = ?`,
        ['what-mirror-is', 'alpha'],
      )
      expect(stored).toMatchObject({ projection_status: 'accepted', receipt_id: projected.receiptId, accepted_revision: 1 })
      const missed = await reopenedPages.queryOne<{ projection_status: string; projection_error: string; receipt_id: string | null }>(
        `SELECT projection_status, projection_error, receipt_id FROM authored_pages WHERE slug = ?`,
        ['projection-miss'],
      )
      expect(missed?.projection_status).toBe('failed')
      expect(missed?.projection_error).toContain('no_grant')
      expect(missed?.receipt_id).toBeNull()
      await withdrawPage(reopenedPages, ada, 'what-mirror-is')
      const audit = await readAudit(reopenedPages, ada, 'what-mirror-is')
      expect(audit.map(row => row.action)).toEqual(['authored', 'projected', 'withdrawn'])
      expect(await lookupPage(reopenedPages, ada, 'what-mirror-is')).toBeNull()
      reopenedPages.close()
    } finally {
      await stopMirror(bridge.child)
    }

    expect(await map.search(ALPHA_BODY)).toEqual([])
    const reopened = await runPython(python, REOPEN, [repo, mirrorPath], repo)
    expect(reopened.code, reopened.stderr).toBe(0)
    const mirror = JSON.parse(reopened.stdout) as {
      before: {
        alpha: { text: string; source_revision: number; project: string; approved: boolean; synthesized: boolean; raw_data: { untrusted: { project: string; approved: boolean } } }
        beta: null
        beta_search: unknown[]
        beta_count: number
        alpha_count: number
        failed: null
      }
      withdrawn: { status: string }
      after: null
      audit: { archived: boolean; text: string; audit: Array<{ action: string }>; receipts: Array<{ action_type: string; output: { approved: boolean } }>; approved: boolean }
    }
    expect(mirror.before.alpha.text).toBe(ALPHA_BODY)
    expect(mirror.before.alpha.source_revision).toBe(1)
    expect(mirror.before.alpha.project).toBe('alpha')
    expect(mirror.before.alpha.approved).toBe(false)
    expect(mirror.before.alpha.synthesized).toBe(false)
    expect(mirror.before.alpha.raw_data.untrusted.project).toBe('beta')
    expect(mirror.before.alpha.raw_data.untrusted.approved).toBe(true)
    expect(mirror.before.beta).toBeNull()
    expect(mirror.before.beta_search).toEqual([])
    expect(mirror.before.beta_count).toBe(0)
    expect(mirror.before.alpha_count).toBe(1)
    expect(mirror.before.failed).toBeNull()
    expect(JSON.stringify(mirror.before)).not.toContain('FAILED-BRIDGE-BODY')
    expect(mirror.withdrawn.status).toBe('withdrawn')
    expect(mirror.after).toBeNull()
    expect(mirror.audit.archived).toBe(true)
    expect(mirror.audit.text).toBe(ALPHA_BODY)
    expect(mirror.audit.audit.map(row => row.action)).toContain('withdrawn')
    expect(mirror.audit.receipts[0]?.action_type).toBe('mirror.engram.write')
    expect(mirror.audit.receipts[0]?.output.approved).toBe(false)
    expect(mirror.audit.approved).toBe(false)
  }, 20000)
})
