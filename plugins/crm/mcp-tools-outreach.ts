/**
 * CRM Outreach MCP tools — find_leads + run_outreach.
 *
 * find_leads: search contacts with optional external enrichment via webhook.
 * run_outreach: create an outreach sequence and optionally trigger via n8n.
 *
 * Migration: 0017_outreach.sql (tables: outreach_sequences, outreach_steps)
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

interface ContactRow {
  id: string
  tenant_slug: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  source: string | null
  stage: string | null
  tags: string | null
  custom_fields: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface EnrichmentContact {
  email?: string
  first_name?: string
  last_name?: string
  company?: string
  title?: string
  phone?: string
  source?: string
  custom_fields?: Record<string, unknown>
}

/** Ensure outreach tables exist (idempotent). */
async function ensureOutreachTables(db: Env['DB_CORE']): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS outreach_sequences (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        tenant_slug TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        channel TEXT DEFAULT 'email',
        status TEXT DEFAULT 'draft',
        template TEXT,
        n8n_webhook_url TEXT,
        contact_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        replied_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS outreach_steps (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        sequence_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        scheduled_at TEXT,
        sent_at TEXT,
        opened_at TEXT,
        replied_at TEXT,
        FOREIGN KEY (sequence_id) REFERENCES outreach_sequences(id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      )
    `).run()
  } catch {
    // Tables already exist — safe to ignore
  }
}

export const outreachMcpTools: McpToolDef[] = [
  {
    name: 'find_leads',
    description:
      'Search for leads in the CRM by name, email, company, industry, location, or source. Optionally enrich results via external webhook (set ENRICHMENT_WEBHOOK_URL env var).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name, email, or company' },
        industry: { type: 'string', description: 'Filter by industry (stored in custom_fields)' },
        location: { type: 'string', description: 'Filter by location (stored in custom_fields)' },
        source: { type: 'string', description: 'Filter by lead source (e.g. "website", "referral")' },
        enrich: {
          type: 'boolean',
          description: 'If true, also calls enrichment webhook to discover new leads. Requires ENRICHMENT_WEBHOOK_URL env var.',
          default: false,
        },
        limit: { type: 'number', description: 'Max results to return (default 20)', default: 20 },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const query = typeof a.query === 'string' ? a.query.trim() : ''
      const industry = typeof a.industry === 'string' ? a.industry.trim() : ''
      const location = typeof a.location === 'string' ? a.location.trim() : ''
      const source = typeof a.source === 'string' ? a.source.trim() : ''
      const enrich = a.enrich === true
      const limit = typeof a.limit === 'number' && a.limit > 0 ? Math.min(a.limit, 100) : 20

      // Build WHERE clauses
      const conditions: string[] = []
      const bindings: string[] = []

      if (query) {
        conditions.push(
          '(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)',
        )
        const like = `%${query}%`
        bindings.push(like, like, like, like)
      }

      if (source) {
        conditions.push('source = ?')
        bindings.push(source)
      }

      if (industry) {
        conditions.push("json_extract(custom_fields, '$.industry') LIKE ?")
        bindings.push(`%${industry}%`)
      }

      if (location) {
        conditions.push("json_extract(custom_fields, '$.location') LIKE ?")
        bindings.push(`%${location}%`)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const sql = `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ?`
      bindings.push(String(limit))

      const stmt = env.DB_CORE.prepare(sql)
      const bound = stmt.bind(...bindings)
      const result = await bound.all<ContactRow>()
      const leads = result.results ?? []

      // Enrichment via external webhook
      let enrichedCount = 0
      if (enrich) {
        const webhookUrl = (env as Record<string, string>)['ENRICHMENT_WEBHOOK_URL']
        if (webhookUrl) {
          try {
            const res = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, industry, location }),
            })

            if (res.ok) {
              const body = (await res.json()) as unknown
              const enriched = Array.isArray(body) ? (body as EnrichmentContact[]) : []

              for (const contact of enriched) {
                if (!contact.email) continue

                // Upsert: insert or update on email match
                const existing = await env.DB_CORE.prepare(
                  'SELECT id FROM contacts WHERE email = ?',
                ).bind(contact.email).first<{ id: string }>()

                if (existing) {
                  await env.DB_CORE.prepare(
                    "UPDATE contacts SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), company = COALESCE(?, company), title = COALESCE(?, title), phone = COALESCE(?, phone), custom_fields = COALESCE(?, custom_fields), updated_at = datetime('now') WHERE id = ?",
                  ).bind(
                    contact.first_name ?? null,
                    contact.last_name ?? null,
                    contact.company ?? null,
                    contact.title ?? null,
                    contact.phone ?? null,
                    contact.custom_fields ? JSON.stringify(contact.custom_fields) : null,
                    existing.id,
                  ).run()
                } else {
                  await env.DB_CORE.prepare(
                    'INSERT INTO contacts (email, first_name, last_name, company, title, phone, source, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  ).bind(
                    contact.email,
                    contact.first_name ?? null,
                    contact.last_name ?? null,
                    contact.company ?? null,
                    contact.title ?? null,
                    contact.phone ?? null,
                    contact.source ?? 'enrichment',
                    contact.custom_fields ? JSON.stringify(contact.custom_fields) : '{}',
                  ).run()
                }
                enrichedCount++
              }

              // Re-query to include enriched contacts
              if (enrichedCount > 0) {
                const refreshed = await env.DB_CORE.prepare(sql).bind(...bindings).all<ContactRow>()
                return {
                  leads: refreshed.results ?? [],
                  total: refreshed.results?.length ?? 0,
                  enriched_count: enrichedCount,
                }
              }
            }
          } catch {
            // Enrichment failed — return local results only
          }
        }
      }

      return {
        leads,
        total: leads.length,
        ...(enrich ? { enriched_count: enrichedCount } : {}),
      }
    },
  },

  {
    name: 'run_outreach',
    description:
      'Create and trigger an outreach sequence for selected contacts. Supports email, SMS, and LinkedIn channels. Optionally triggers an n8n workflow for execution.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Contact IDs to include in the outreach sequence',
        },
        sequence_name: { type: 'string', description: 'Name for this outreach campaign' },
        channel: {
          type: 'string',
          enum: ['email', 'sms', 'linkedin'],
          description: 'Outreach channel (default: email)',
          default: 'email',
        },
        template: {
          type: 'string',
          description: 'Message template with {{first_name}}, {{company}} placeholders',
        },
        n8n_webhook_url: {
          type: 'string',
          description: 'n8n webhook URL — if provided, triggers the workflow for execution',
        },
        schedule_at: {
          type: 'string',
          description: 'ISO 8601 datetime to schedule the outreach (omit for immediate)',
        },
      },
      required: ['contact_ids', 'sequence_name'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const contactIds = a.contact_ids as string[]
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return { error: 'contact_ids required', message: 'Provide at least one contact ID' }
      }

      const sequenceName = typeof a.sequence_name === 'string' ? a.sequence_name.trim() : ''
      if (!sequenceName) return { error: 'sequence_name required' }

      const channel = typeof a.channel === 'string' ? a.channel : 'email'
      if (!['email', 'sms', 'linkedin'].includes(channel)) {
        return { error: 'invalid_channel', valid: ['email', 'sms', 'linkedin'] }
      }

      const template = typeof a.template === 'string' ? a.template : null
      const n8nWebhookUrl = typeof a.n8n_webhook_url === 'string' ? a.n8n_webhook_url : null
      const scheduleAt = typeof a.schedule_at === 'string' ? a.schedule_at : null

      // Ensure tables exist
      await ensureOutreachTables(env.DB_CORE)

      // Create sequence record
      const seqResult = await env.DB_CORE.prepare(
        'INSERT INTO outreach_sequences (name, channel, status, template, n8n_webhook_url, contact_count) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      ).bind(
        sequenceName,
        channel,
        scheduleAt ? 'scheduled' : 'active',
        template,
        n8nWebhookUrl,
        contactIds.length,
      ).first<{ id: string }>()

      if (!seqResult) {
        return { error: 'failed_to_create_sequence', message: 'Could not insert outreach sequence' }
      }

      const sequenceId = seqResult.id

      // Create outreach steps for each contact
      for (const contactId of contactIds) {
        await env.DB_CORE.prepare(
          'INSERT INTO outreach_steps (sequence_id, contact_id, status, scheduled_at) VALUES (?, ?, ?, ?)',
        ).bind(sequenceId, contactId, scheduleAt ? 'scheduled' : 'pending', scheduleAt).run()

        // Log activity for each contact
        await env.DB_CORE.prepare(
          'INSERT INTO activities (contact_id, type, subject, body, performed_by) VALUES (?, ?, ?, ?, ?)',
        ).bind(
          contactId,
          'outreach',
          `Added to outreach: ${sequenceName}`,
          `Channel: ${channel}${template ? ', template applied' : ''}`,
          'agent',
        ).run()
      }

      // Trigger n8n workflow if URL provided
      let triggered = false
      if (n8nWebhookUrl) {
        // Fetch contact details for the webhook payload
        const placeholders = contactIds.map(() => '?').join(',')
        const contacts = await env.DB_CORE.prepare(
          `SELECT id, email, phone, first_name, last_name, company FROM contacts WHERE id IN (${placeholders})`,
        ).bind(...contactIds).all<ContactRow>()

        try {
          const res = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sequence_id: sequenceId,
              sequence_name: sequenceName,
              channel,
              template,
              schedule_at: scheduleAt,
              contacts: contacts.results ?? [],
            }),
          })
          triggered = res.ok
        } catch {
          // n8n unreachable — sequence created but not triggered
        }
      }

      return {
        ok: true,
        sequence_id: sequenceId,
        contact_count: contactIds.length,
        triggered,
      }
    },
  },
]
