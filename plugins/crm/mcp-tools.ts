import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const crmMcpTools: McpToolDef[] = [
  // ── create_contact ──────────────────────────────────────────────────────────
  {
    name: 'create_contact',
    description: 'Create a new CRM contact. Requires at least email or phone.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Contact email address' },
        phone: { type: 'string', description: 'Contact phone number' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        company: { type: 'string', description: 'Company name' },
        title: { type: 'string', description: 'Job title' },
        source: {
          type: 'string',
          description: 'Lead source (default: manual)',
          enum: ['manual', 'website', 'referral', 'social', 'ads', 'event', 'import'],
        },
        stage: {
          type: 'string',
          description: 'Contact stage (default: lead)',
          enum: ['lead', 'prospect', 'qualified', 'customer', 'churned'],
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        notes: { type: 'string', description: 'Free-text notes' },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env // cast to typed Worker env

      const email = typeof a.email === 'string' ? a.email.trim().toLowerCase() : null
      const phone = typeof a.phone === 'string' ? a.phone.trim() : null

      if (!email && !phone) {
        return { error: 'At least email or phone is required' }
      }

      const firstName = typeof a.first_name === 'string' ? a.first_name.trim() : null
      const lastName = typeof a.last_name === 'string' ? a.last_name.trim() : null
      const company = typeof a.company === 'string' ? a.company.trim() : null
      const title = typeof a.title === 'string' ? a.title.trim() : null
      const source = typeof a.source === 'string' ? a.source.trim() : 'manual'
      const stage = typeof a.stage === 'string' ? a.stage.trim() : 'lead'
      const tags = Array.isArray(a.tags)
        ? JSON.stringify((a.tags as unknown[]).filter((t): t is string => typeof t === 'string'))
        : '[]'
      const notes = typeof a.notes === 'string' ? a.notes.trim() : null

      const result = await env.DB_CORE.prepare(
        `INSERT INTO contacts (tenant_slug, email, phone, first_name, last_name, company, title, source, stage, tags, notes)
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id, email, stage`
      )
        .bind(email, phone, firstName, lastName, company, title, source, stage, tags, notes)
        .first()

      if (!result) {
        return { error: 'Failed to create contact' }
      }

      return { ok: true, id: result.id, email: result.email, stage: result.stage }
    },
  },

  // ── update_contact ──────────────────────────────────────────────────────────
  {
    name: 'update_contact',
    description: 'Update an existing CRM contact by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID (required)' },
        email: { type: 'string', description: 'New email' },
        phone: { type: 'string', description: 'New phone' },
        first_name: { type: 'string', description: 'New first name' },
        last_name: { type: 'string', description: 'New last name' },
        company: { type: 'string', description: 'New company' },
        title: { type: 'string', description: 'New job title' },
        stage: { type: 'string', description: 'New stage' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
        notes: { type: 'string', description: 'New notes' },
        custom_fields: { type: 'object', description: 'Custom field key-value pairs' },
      },
      required: ['contact_id'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env // cast to typed Worker env

      const contactId = typeof a.contact_id === 'string' ? a.contact_id.trim() : ''
      if (!contactId) {
        return { error: 'contact_id is required' }
      }

      const updatableFields: Array<{ key: string; column: string; value: unknown }> = []

      if (typeof a.email === 'string') updatableFields.push({ key: 'email', column: 'email', value: a.email.trim().toLowerCase() })
      if (typeof a.phone === 'string') updatableFields.push({ key: 'phone', column: 'phone', value: a.phone.trim() })
      if (typeof a.first_name === 'string') updatableFields.push({ key: 'first_name', column: 'first_name', value: a.first_name.trim() })
      if (typeof a.last_name === 'string') updatableFields.push({ key: 'last_name', column: 'last_name', value: a.last_name.trim() })
      if (typeof a.company === 'string') updatableFields.push({ key: 'company', column: 'company', value: a.company.trim() })
      if (typeof a.title === 'string') updatableFields.push({ key: 'title', column: 'title', value: a.title.trim() })
      if (typeof a.stage === 'string') updatableFields.push({ key: 'stage', column: 'stage', value: a.stage.trim() })
      if (typeof a.notes === 'string') updatableFields.push({ key: 'notes', column: 'notes', value: a.notes.trim() })
      if (Array.isArray(a.tags)) {
        const tagsJson = JSON.stringify((a.tags as unknown[]).filter((t): t is string => typeof t === 'string'))
        updatableFields.push({ key: 'tags', column: 'tags', value: tagsJson })
      }
      if (a.custom_fields !== null && typeof a.custom_fields === 'object' && !Array.isArray(a.custom_fields)) {
        updatableFields.push({ key: 'custom_fields', column: 'custom_fields', value: JSON.stringify(a.custom_fields) })
      }

      if (updatableFields.length === 0) {
        return { error: 'No fields to update' }
      }

      const setClauses = updatableFields.map((f) => `${f.column} = ?`).join(', ')
      const values = updatableFields.map((f) => f.value)

      await env.DB_CORE.prepare(
        `UPDATE contacts SET ${setClauses}, updated_at = datetime('now') WHERE id = ? AND tenant_slug = 'default'`
      )
        .bind(...values, contactId)
        .run()

      return {
        ok: true,
        id: contactId,
        updated_fields: updatableFields.map((f) => f.key),
      }
    },
  },

  // ── list_contacts ───────────────────────────────────────────────────────────
  {
    name: 'list_contacts',
    description: 'List or search CRM contacts with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Filter by stage' },
        source: { type: 'string', description: 'Filter by source' },
        search: { type: 'string', description: 'Search name, email, or company' },
        limit: { type: 'number', description: 'Max results (default 50)' },
        offset: { type: 'number', description: 'Offset for pagination (default 0)' },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env // cast to typed Worker env

      const limit = typeof a.limit === 'number' && a.limit > 0 ? Math.min(a.limit, 200) : 50
      const offset = typeof a.offset === 'number' && a.offset >= 0 ? a.offset : 0

      const conditions: string[] = ["tenant_slug = 'default'"]
      const params: unknown[] = []

      if (typeof a.stage === 'string' && a.stage.trim()) {
        conditions.push('stage = ?')
        params.push(a.stage.trim())
      }
      if (typeof a.source === 'string' && a.source.trim()) {
        conditions.push('source = ?')
        params.push(a.source.trim())
      }
      if (typeof a.search === 'string' && a.search.trim()) {
        const term = `%${a.search.trim()}%`
        conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)')
        params.push(term, term, term, term)
      }

      const where = conditions.join(' AND ')

      const countResult = await env.DB_CORE.prepare(
        `SELECT COUNT(*) as total FROM contacts WHERE ${where}`
      )
        .bind(...params)
        .first<{ total: number }>()

      const total = countResult?.total ?? 0

      const rows = await env.DB_CORE.prepare(
        `SELECT id, email, phone, first_name, last_name, company, title, source, stage, tags, notes, created_at, updated_at
         FROM contacts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(...params, limit, offset)
        .all()

      const contacts = (rows.results ?? []).map((row) => ({
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : [],
      }))

      return { contacts, total, limit, offset }
    },
  },

  // ── manage_pipeline ─────────────────────────────────────────────────────────
  {
    name: 'manage_pipeline',
    description: 'Manage pipeline stages and deals. Actions: create_stage, list_stages, create_deal, update_deal, list_deals.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: ['create_stage', 'list_stages', 'create_deal', 'update_deal', 'list_deals'],
        },
        // Stage fields
        name: { type: 'string', description: 'Stage name (for create_stage)' },
        position: { type: 'number', description: 'Stage position/order (for create_stage)' },
        color: { type: 'string', description: 'Stage color hex (for create_stage)' },
        // Deal fields
        contact_id: { type: 'string', description: 'Contact ID (for create_deal)' },
        title: { type: 'string', description: 'Deal title (for create_deal)' },
        value: { type: 'number', description: 'Deal value (for create_deal, update_deal)' },
        currency: { type: 'string', description: 'Currency code (for create_deal, default CAD)' },
        stage_id: { type: 'string', description: 'Pipeline stage ID (for create_deal, update_deal, list_deals filter)' },
        assigned_to: { type: 'string', description: 'Assigned agent/person (for create_deal)' },
        expected_close: { type: 'string', description: 'Expected close date ISO (for create_deal)' },
        deal_id: { type: 'string', description: 'Deal ID (for update_deal)' },
        status: { type: 'string', description: 'Deal status: open, won, lost (for update_deal, list_deals filter)' },
        notes: { type: 'string', description: 'Deal notes (for create_deal, update_deal)' },
        limit: { type: 'number', description: 'Max results (for list_deals)' },
        offset: { type: 'number', description: 'Offset (for list_deals)' },
      },
      required: ['action'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env // cast to typed Worker env
      const action = typeof a.action === 'string' ? a.action : ''

      // ── create_stage ──
      if (action === 'create_stage') {
        const name = typeof a.name === 'string' ? a.name.trim() : ''
        if (!name) return { error: 'name is required for create_stage' }
        const position = typeof a.position === 'number' ? a.position : 0
        const color = typeof a.color === 'string' ? a.color.trim() : '#6366f1'

        const result = await env.DB_CORE.prepare(
          `INSERT INTO pipeline_stages (tenant_slug, name, position, color) VALUES ('default', ?, ?, ?) RETURNING id, name, position, color`
        )
          .bind(name, position, color)
          .first()

        return { ok: true, stage: result }
      }

      // ── list_stages ──
      if (action === 'list_stages') {
        const rows = await env.DB_CORE.prepare(
          `SELECT ps.id, ps.name, ps.position, ps.color, COUNT(d.id) as deal_count
           FROM pipeline_stages ps
           LEFT JOIN deals d ON d.stage_id = ps.id AND d.status = 'open'
           WHERE ps.tenant_slug = 'default'
           GROUP BY ps.id
           ORDER BY ps.position ASC`
        )
          .all()

        return { stages: rows.results ?? [] }
      }

      // ── create_deal ──
      if (action === 'create_deal') {
        const contactId = typeof a.contact_id === 'string' ? a.contact_id.trim() : ''
        const title = typeof a.title === 'string' ? a.title.trim() : ''
        if (!contactId) return { error: 'contact_id is required for create_deal' }
        if (!title) return { error: 'title is required for create_deal' }

        const value = typeof a.value === 'number' ? a.value : 0
        const currency = typeof a.currency === 'string' ? a.currency.trim().toUpperCase() : 'CAD'
        const stageId = typeof a.stage_id === 'string' ? a.stage_id.trim() : null
        const assignedTo = typeof a.assigned_to === 'string' ? a.assigned_to.trim() : null
        const expectedClose = typeof a.expected_close === 'string' ? a.expected_close.trim() : null
        const notes = typeof a.notes === 'string' ? a.notes.trim() : null

        const result = await env.DB_CORE.prepare(
          `INSERT INTO deals (tenant_slug, contact_id, title, value, currency, stage_id, assigned_to, expected_close, notes)
           VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id, title, value, status`
        )
          .bind(contactId, title, value, currency, stageId, assignedTo, expectedClose, notes)
          .first()

        return { ok: true, deal: result }
      }

      // ── update_deal ──
      if (action === 'update_deal') {
        const dealId = typeof a.deal_id === 'string' ? a.deal_id.trim() : ''
        if (!dealId) return { error: 'deal_id is required for update_deal' }

        const updates: Array<{ column: string; value: unknown }> = []

        if (typeof a.stage_id === 'string') updates.push({ column: 'stage_id', value: a.stage_id.trim() })
        if (typeof a.status === 'string') updates.push({ column: 'status', value: a.status.trim() })
        if (typeof a.value === 'number') updates.push({ column: 'value', value: a.value })
        if (typeof a.notes === 'string') updates.push({ column: 'notes', value: a.notes.trim() })

        if (updates.length === 0) return { error: 'No fields to update' }

        const setClauses = updates.map((u) => `${u.column} = ?`).join(', ')
        const values = updates.map((u) => u.value)

        await env.DB_CORE.prepare(
          `UPDATE deals SET ${setClauses}, updated_at = datetime('now') WHERE id = ? AND tenant_slug = 'default'`
        )
          .bind(...values, dealId)
          .run()

        return { ok: true, deal_id: dealId, updated: updates.map((u) => u.column) }
      }

      // ── list_deals ──
      if (action === 'list_deals') {
        const limit = typeof a.limit === 'number' && a.limit > 0 ? Math.min(a.limit, 200) : 50
        const offset = typeof a.offset === 'number' && a.offset >= 0 ? a.offset : 0

        const conditions: string[] = ["d.tenant_slug = 'default'"]
        const params: unknown[] = []

        if (typeof a.status === 'string' && a.status.trim()) {
          conditions.push('d.status = ?')
          params.push(a.status.trim())
        }
        if (typeof a.stage_id === 'string' && a.stage_id.trim()) {
          conditions.push('d.stage_id = ?')
          params.push(a.stage_id.trim())
        }

        const where = conditions.join(' AND ')

        const rows = await env.DB_CORE.prepare(
          `SELECT d.id, d.contact_id, d.title, d.value, d.currency, d.stage_id, d.status, d.assigned_to, d.expected_close, d.notes, d.created_at, d.updated_at,
                  c.first_name, c.last_name, c.email as contact_email, c.company as contact_company
           FROM deals d
           LEFT JOIN contacts c ON c.id = d.contact_id
           WHERE ${where}
           ORDER BY d.created_at DESC LIMIT ? OFFSET ?`
        )
          .bind(...params, limit, offset)
          .all()

        return { deals: rows.results ?? [], limit, offset }
      }

      return { error: `Unknown action: ${action}` }
    },
  },

  // ── log_activity ────────────────────────────────────────────────────────────
  {
    name: 'log_activity',
    description: 'Log an activity (call, email, meeting, note, task, sms) against a CRM contact.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID (required)' },
        type: {
          type: 'string',
          description: 'Activity type',
          enum: ['call', 'email', 'meeting', 'note', 'task', 'sms'],
        },
        subject: { type: 'string', description: 'Activity subject line' },
        body: { type: 'string', description: 'Activity body/details' },
        deal_id: { type: 'string', description: 'Optional deal ID to associate' },
      },
      required: ['contact_id', 'type'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env // cast to typed Worker env

      const contactId = typeof a.contact_id === 'string' ? a.contact_id.trim() : ''
      const type = typeof a.type === 'string' ? a.type.trim() : ''
      if (!contactId) return { error: 'contact_id is required' }
      if (!type) return { error: 'type is required' }

      const subject = typeof a.subject === 'string' ? a.subject.trim() : null
      const body = typeof a.body === 'string' ? a.body.trim() : null
      const dealId = typeof a.deal_id === 'string' ? a.deal_id.trim() : null

      const result = await env.DB_CORE.prepare(
        `INSERT INTO activities (tenant_slug, contact_id, deal_id, type, subject, body)
         VALUES ('default', ?, ?, ?, ?, ?)
         RETURNING id`
      )
        .bind(contactId, dealId, type, subject, body)
        .first()

      if (!result) {
        return { error: 'Failed to log activity' }
      }

      return { ok: true, id: result.id }
    },
  },
]
