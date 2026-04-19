/**
 * onboard_client MCP tool — full agency onboarding pipeline in one call.
 *
 * Orchestrates:
 *   1. Register client in agency_clients table
 *   2. Business intake — create wiki pages (overview, services, audience, competitors, brand, channels, goals)
 *   3. Content strategy — generate marketing plan from wiki
 *   4. Landing page generation — template x cities x services cartesian product
 *   5. CRM contact creation
 *   6. Update client record with pages_created + onboarded_at
 *
 * Plugins MUST NOT import from other plugins — all helpers are duplicated locally.
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

// ── Local helpers (duplicated from content plugin — no cross-plugin imports) ──

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function storePage(
  env: Env,
  slug: string,
  title: string,
  content: string,
  tags: string[],
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  const description = content.replace(/[#*_>\-\[\]`]/g, ' ').trim().slice(0, 220)

  const frontmatter = [
    `title: "${title}"`,
    `date: "${date}"`,
    `author: "agent"`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `description: "${description}"`,
    `status: "published"`,
    `type: "wiki"`,
  ].join('\n')

  const markdown = `---\n${frontmatter}\n---\n\n${content}`

  await env.CONTENT.put(`post:${slug}`, markdown)
  await env.CONTENT.put(
    `meta:${slug}`,
    JSON.stringify({ title, slug, author: 'agent', tags, description, date, status: 'published' }),
  )

  await env.DB_ANALYTICS.prepare(
    'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(slug, title, 'wiki', 'en', 'agent', JSON.stringify(tags), description, date, date, content.split(/\s+/).length)
    .run()
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value)
  }
  return result
}

const DEFAULT_LANDING_TEMPLATE = `# Best {service} in {city}

Looking for expert {service} in {city}? {business_name} delivers results-driven {service} strategies.

## Why {business_name}?
- Data-driven approach with measurable ROI
- Deep understanding of the {city} market
- Proven track record across industries

## Get Started
Contact {business_name} today for a free {service} consultation.`

const DEFAULT_CITIES = ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa']

const ENSURE_AGENCY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS agency_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'active',
  config TEXT DEFAULT '{}',
  pages_created INTEGER DEFAULT 0,
  onboarded_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`

const ENSURE_CONTACTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  source TEXT DEFAULT 'manual',
  stage TEXT DEFAULT 'lead',
  tags TEXT DEFAULT '[]',
  custom_fields TEXT DEFAULT '{}',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`

// ── Tool definition ──────────────────────────────────────────────────────────

export const onboardMcpTools: McpToolDef[] = [
  {
    name: 'onboard_client',
    description:
      'Full agency onboarding pipeline — registers client, builds business wiki, generates content strategy, creates scale landing pages, and sets up CRM contact. Call this once to onboard a new agency client end-to-end.',
    inputSchema: {
      type: 'object',
      properties: {
        // Business intake fields
        name: { type: 'string', description: 'Business name (required)' },
        industry: { type: 'string', description: 'Industry/sector' },
        description: { type: 'string', description: 'What the business does (2-3 sentences)' },
        services: { type: 'array', items: { type: 'string' }, description: 'List of services or products offered' },
        website: { type: 'string', description: 'Website URL' },
        phone: { type: 'string', description: 'Business phone' },
        email: { type: 'string', description: 'Business contact email' },
        address: { type: 'string', description: 'Physical address' },
        target_audience: { type: 'string', description: 'Who the business serves' },
        competitors: { type: 'array', items: { type: 'string' }, description: 'Known competitors' },
        brand_voice: { type: 'string', description: 'Brand tone and personality' },
        unique_value: { type: 'string', description: 'Unique value proposition' },
        social_accounts: { type: 'object', description: 'Social media handles: { twitter, linkedin, instagram, ... }' },
        goals: { type: 'array', items: { type: 'string' }, description: 'Business goals for the next 3-6 months' },
        budget: { type: 'string', description: 'Monthly marketing budget range' },
        notes: { type: 'string', description: 'Any other relevant info' },
        contact_name: { type: 'string', description: 'Primary contact person name' },
        // Agency-specific fields
        generate_landing_pages: {
          type: 'boolean',
          description: 'Whether to generate scale landing pages (default: true)',
        },
        landing_page_cities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cities for landing pages (default: Toronto, Vancouver, Montreal, Calgary, Ottawa)',
        },
        landing_page_template: {
          type: 'string',
          description: 'Custom markdown template for landing pages with {service}, {city}, {business_name} placeholders',
        },
      },
      required: ['name'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const bizName = typeof a.name === 'string' ? a.name.trim() : ''
      if (!bizName) return { error: 'name is required' }

      const bizSlug = slugify(bizName)
      const warnings: string[] = []
      const stepsCompleted: string[] = []
      const wikiPages: string[] = []
      let landingPagesCount = 0

      // ── Step 1: Register client in agency_clients ──────────────────────
      try {
        try {
          await env.DB_CORE.prepare(ENSURE_AGENCY_TABLE_SQL).run()
        } catch {
          // table exists
        }

        const industry = typeof a.industry === 'string' ? a.industry.trim() : null
        const contactName = typeof a.contact_name === 'string' ? a.contact_name.trim() : null
        const contactEmail = typeof a.email === 'string' ? a.email.trim().toLowerCase() : null
        const config = JSON.stringify({
          website: typeof a.website === 'string' ? a.website : null,
          phone: typeof a.phone === 'string' ? a.phone : null,
          address: typeof a.address === 'string' ? a.address : null,
          budget: typeof a.budget === 'string' ? a.budget : null,
        })

        await env.DB_CORE.prepare(
          `INSERT INTO agency_clients (slug, name, industry, contact_name, contact_email, status, config)
           VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        )
          .bind(bizSlug, bizName, industry, contactName, contactEmail, config)
          .run()

        stepsCompleted.push('registered')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        warnings.push(`register_client: ${msg}`)
      }

      // ── Step 2: Business intake — create wiki pages ────────────────────
      try {
        const tags = ['wiki', 'business', bizSlug]

        // Overview page
        const overviewLines = [
          `# ${bizName}`,
          '',
          typeof a.description === 'string' ? a.description : `Business profile for ${bizName}.`,
          '',
          '## Quick Facts',
          '',
          typeof a.industry === 'string' ? `- **Industry:** ${a.industry}` : null,
          typeof a.website === 'string' ? `- **Website:** ${a.website}` : null,
          typeof a.phone === 'string' ? `- **Phone:** ${a.phone}` : null,
          typeof a.email === 'string' ? `- **Email:** ${a.email}` : null,
          typeof a.address === 'string' ? `- **Address:** ${a.address}` : null,
          typeof a.unique_value === 'string' ? `- **Value Prop:** ${a.unique_value}` : null,
          typeof a.budget === 'string' ? `- **Marketing Budget:** ${a.budget}` : null,
          '',
          '## Wiki',
          '',
          Array.isArray(a.services) && a.services.length > 0 ? `- [[${bizSlug}-services|Services]]` : null,
          typeof a.target_audience === 'string' ? `- [[${bizSlug}-audience|Target Audience]]` : null,
          Array.isArray(a.competitors) && a.competitors.length > 0 ? `- [[${bizSlug}-competitors|Competitors]]` : null,
          typeof a.brand_voice === 'string' ? `- [[${bizSlug}-brand|Brand Voice]]` : null,
          typeof a.social_accounts === 'object' && a.social_accounts !== null ? `- [[${bizSlug}-channels|Channels]]` : null,
          Array.isArray(a.goals) && a.goals.length > 0 ? `- [[${bizSlug}-goals|Goals]]` : null,
        ]
          .filter(Boolean)
          .join('\n')

        await storePage(env, `${bizSlug}-overview`, `${bizName} — Overview`, overviewLines, tags)
        wikiPages.push(`${bizSlug}-overview`)

        // Services page
        const services = Array.isArray(a.services)
          ? (a.services as unknown[]).filter((s): s is string => typeof s === 'string')
          : []
        if (services.length > 0) {
          const servicesContent = [
            `# ${bizName} — Services`,
            '',
            `Services offered by [[${bizSlug}-overview|${bizName}]]:`,
            '',
            ...services.map((s) => `- **${s}**`),
            '',
            `See also: [[${bizSlug}-audience|Target Audience]], [[${bizSlug}-competitors|Competitors]]`,
          ].join('\n')

          await storePage(env, `${bizSlug}-services`, `${bizName} — Services`, servicesContent, [...tags, 'services'])
          wikiPages.push(`${bizSlug}-services`)
        }

        // Audience page
        if (typeof a.target_audience === 'string') {
          const audienceContent = [
            `# ${bizName} — Target Audience`,
            '',
            a.target_audience,
            '',
            `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-services|Services]]`,
          ].join('\n')

          await storePage(env, `${bizSlug}-audience`, `${bizName} — Target Audience`, audienceContent, [...tags, 'audience'])
          wikiPages.push(`${bizSlug}-audience`)
        }

        // Competitors page
        const competitors = Array.isArray(a.competitors)
          ? (a.competitors as unknown[]).filter((c): c is string => typeof c === 'string')
          : []
        if (competitors.length > 0) {
          const competitorsContent = [
            `# ${bizName} — Competitive Landscape`,
            '',
            `Known competitors for [[${bizSlug}-overview|${bizName}]]:`,
            '',
            ...competitors.map((c) => `- **${c}**`),
            '',
            `See also: [[${bizSlug}-services|Services]], [[${bizSlug}-audience|Target Audience]]`,
          ].join('\n')

          await storePage(env, `${bizSlug}-competitors`, `${bizName} — Competitors`, competitorsContent, [...tags, 'competitors'])
          wikiPages.push(`${bizSlug}-competitors`)
        }

        // Brand voice page
        if (typeof a.brand_voice === 'string') {
          const brandContent = [
            `# ${bizName} — Brand Voice`,
            '',
            `Brand voice and positioning for [[${bizSlug}-overview|${bizName}]]:`,
            '',
            a.brand_voice,
            '',
            typeof a.unique_value === 'string' ? `## Unique Value Proposition\n\n${a.unique_value}` : '',
            '',
            `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-channels|Channels]]`,
          ]
            .filter(Boolean)
            .join('\n')

          await storePage(env, `${bizSlug}-brand`, `${bizName} — Brand Voice`, brandContent, [...tags, 'brand'])
          wikiPages.push(`${bizSlug}-brand`)
        }

        // Channels page
        if (typeof a.social_accounts === 'object' && a.social_accounts !== null && !Array.isArray(a.social_accounts)) {
          const socialEntries = Object.entries(a.social_accounts as Record<string, unknown>).filter(
            ([, v]) => typeof v === 'string' && v,
          )
          if (socialEntries.length > 0) {
            const channelLines = socialEntries.map(([platform, handle]) => `- **${platform}:** ${handle as string}`)

            const channelsContent = [
              `# ${bizName} — Channels`,
              '',
              `Online presence for [[${bizSlug}-overview|${bizName}]]:`,
              '',
              typeof a.website === 'string' ? `- **Website:** ${a.website}` : '',
              ...channelLines,
              '',
              `See also: [[${bizSlug}-brand|Brand Voice]], [[${bizSlug}-audience|Target Audience]]`,
            ]
              .filter(Boolean)
              .join('\n')

            await storePage(env, `${bizSlug}-channels`, `${bizName} — Channels`, channelsContent, [...tags, 'channels'])
            wikiPages.push(`${bizSlug}-channels`)
          }
        }

        // Goals page
        const goals = Array.isArray(a.goals)
          ? (a.goals as unknown[]).filter((g): g is string => typeof g === 'string')
          : []
        if (goals.length > 0) {
          const goalsContent = [
            `# ${bizName} — Goals`,
            '',
            `Business goals for [[${bizSlug}-overview|${bizName}]]:`,
            '',
            ...goals.map((g, i) => `${i + 1}. ${g}`),
            '',
            typeof a.notes === 'string' ? `## Notes\n\n${a.notes}` : '',
            '',
            `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-services|Services]]`,
          ]
            .filter(Boolean)
            .join('\n')

          await storePage(env, `${bizSlug}-goals`, `${bizName} — Goals`, goalsContent, [...tags, 'goals'])
          wikiPages.push(`${bizSlug}-goals`)
        }

        stepsCompleted.push('wiki_created')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        warnings.push(`business_intake: ${msg}`)
      }

      // ── Step 3: Content strategy ───────────────────────────────────────
      try {
        const overviewRaw = await env.CONTENT.get(`post:${bizSlug}-overview`)
        const servicesRaw = await env.CONTENT.get(`post:${bizSlug}-services`)
        const competitorsRaw = await env.CONTENT.get(`post:${bizSlug}-competitors`)

        // Extract service names
        const extractedServices: string[] = []
        if (servicesRaw) {
          const matches = servicesRaw.match(/\*\*([^*]+)\*\*/g)
          if (matches) extractedServices.push(...matches.map((m) => m.replace(/\*\*/g, '')))
        }

        // Extract competitor names
        const extractedCompetitors: string[] = []
        if (competitorsRaw) {
          const matches = competitorsRaw.match(/\*\*([^*]+)\*\*/g)
          if (matches) extractedCompetitors.push(...matches.map((m) => m.replace(/\*\*/g, '')))
        }

        // Build strategy content
        const seoTopics = extractedServices.flatMap((service) => [
          `${service} — what it is and who needs it`,
          `${service} — vs competitors comparison`,
          `${service} — case study / results`,
          `best ${service} in [city/region]`,
        ])

        const contentPlan = extractedServices.slice(0, 5).map((service) => ({
          type: 'blog',
          topic: `Complete Guide to ${service}`,
          priority: 'high',
        }))

        for (const comp of extractedCompetitors.slice(0, 3)) {
          contentPlan.push({
            type: 'blog',
            topic: `${bizName} vs ${comp} — honest comparison`,
            priority: 'medium',
          })
        }

        const date = new Date().toISOString().slice(0, 10)
        const strategyContent = [
          `# ${bizName} — Marketing Strategy`,
          '',
          `Generated for [[${bizSlug}-overview|${bizName}]] on ${date}.`,
          '',
          '## SEO Targets',
          '',
          ...seoTopics.slice(0, 12).map((t) => `- ${t}`),
          '',
          '## Content Plan',
          '',
          ...contentPlan.map((p) => `- **[${p.priority}]** ${p.topic} (${p.type})`),
          '',
          '## Execution Order',
          '',
          '### Week 1',
          '- Publish service pages with schema markup',
          '- Set up Google Business Profile',
          '- Install tracking pixels',
          '',
          '### Week 2',
          '- Write first 2 blog posts',
          '- Set up social accounts',
          '- Launch brand search campaign',
          '',
          '### Week 3-4',
          '- Publish case studies',
          '- Start social posting cadence',
          '- Set up retargeting',
          '',
          overviewRaw ? '' : '',
        ]
          .filter((line) => line !== undefined)
          .join('\n')

        await env.CONTENT.put(`post:${bizSlug}-strategy`, strategyContent)
        await env.CONTENT.put(
          `meta:${bizSlug}-strategy`,
          JSON.stringify({
            title: `${bizName} — Strategy`,
            slug: `${bizSlug}-strategy`,
            author: 'agent',
            tags: ['wiki', 'strategy', bizSlug],
            date,
            status: 'published',
          }),
        )
        wikiPages.push(`${bizSlug}-strategy`)

        stepsCompleted.push('strategy_generated')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        warnings.push(`content_strategy: ${msg}`)
      }

      // ── Step 4: Generate landing pages ─────────────────────────────────
      const shouldGeneratePages = a.generate_landing_pages !== false
      if (shouldGeneratePages) {
        try {
          const services = Array.isArray(a.services)
            ? (a.services as unknown[]).filter((s): s is string => typeof s === 'string')
            : []

          if (services.length > 0) {
            const cities = Array.isArray(a.landing_page_cities)
              ? (a.landing_page_cities as unknown[]).filter((c): c is string => typeof c === 'string')
              : DEFAULT_CITIES

            const template =
              typeof a.landing_page_template === 'string' ? a.landing_page_template : DEFAULT_LANDING_TEMPLATE

            const date = new Date().toISOString().slice(0, 10)
            const landingTags = ['landing-page', bizSlug]

            for (const service of services) {
              for (const city of cities) {
                const vars = { service, city, business_name: bizName }
                const content = interpolate(template, vars)
                const title = `Best ${service} in ${city} — ${bizName}`
                const pageSlug = slugify(`${bizSlug}-${service}-${city}`)

                const description = content.replace(/[#*_>\-\[\]`]/g, ' ').trim().slice(0, 220)
                const wordCount = content.split(/\s+/).filter(Boolean).length

                const frontmatter = [
                  `title: "${title}"`,
                  `date: "${date}"`,
                  `author: "generator"`,
                  `tags: [${landingTags.map((t) => `"${t}"`).join(', ')}]`,
                  `description: "${description}"`,
                  `status: "published"`,
                ].join('\n')

                const markdown = `---\n${frontmatter}\n---\n\n${content}`

                await env.CONTENT.put(`post:${pageSlug}`, markdown)
                await env.CONTENT.put(
                  `meta:${pageSlug}`,
                  JSON.stringify({
                    title,
                    slug: pageSlug,
                    collection: 'landing-pages',
                    author: 'generator',
                    tags: landingTags,
                    description,
                    date,
                    status: 'published',
                  }),
                )

                await env.DB_ANALYTICS.prepare(
                  'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                  .bind(pageSlug, title, 'landing-pages', 'en', 'generator', JSON.stringify(landingTags), description, date, date, wordCount)
                  .run()

                landingPagesCount++
              }
            }

            stepsCompleted.push('pages_generated')
          } else {
            warnings.push('pages_skipped: no services provided — cannot generate landing pages without services')
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'unknown error'
          warnings.push(`generate_pages: ${msg}`)
        }
      }

      // ── Step 5: Create CRM contact ─────────────────────────────────────
      try {
        try {
          await env.DB_CORE.prepare(ENSURE_CONTACTS_TABLE_SQL).run()
        } catch {
          // table exists
        }

        const contactEmail = typeof a.email === 'string' ? a.email.trim().toLowerCase() : null
        const contactName = typeof a.contact_name === 'string' ? a.contact_name.trim() : null

        if (contactEmail || contactName) {
          const firstName = contactName ? contactName.split(' ')[0] : null
          const lastName = contactName && contactName.includes(' ') ? contactName.split(' ').slice(1).join(' ') : null

          await env.DB_CORE.prepare(
            `INSERT INTO contacts (tenant_slug, email, phone, first_name, last_name, company, source, stage, tags, notes)
             VALUES (?, ?, ?, ?, ?, ?, 'agency', 'customer', ?, ?)`,
          )
            .bind(
              bizSlug,
              contactEmail,
              typeof a.phone === 'string' ? a.phone.trim() : null,
              firstName,
              lastName,
              bizName,
              JSON.stringify(['agency-client', bizSlug]),
              typeof a.notes === 'string' ? a.notes.trim() : null,
            )
            .run()

          stepsCompleted.push('crm_contact_created')
        } else {
          warnings.push('crm_skipped: no email or contact_name provided')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        warnings.push(`crm_contact: ${msg}`)
      }

      // ── Step 6: Update client record ───────────────────────────────────
      try {
        const totalPages = wikiPages.length + landingPagesCount

        await env.DB_CORE.prepare(
          `UPDATE agency_clients SET pages_created = ?, onboarded_at = datetime('now'), updated_at = datetime('now') WHERE slug = ?`,
        )
          .bind(totalPages, bizSlug)
          .run()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        warnings.push(`update_client: ${msg}`)
      }

      // Trigger deploy hook so pages go live immediately
      let deploy = 'manual'
      if (landingPagesCount > 0 && env.CF_PAGES_DEPLOY_HOOK) {
        try {
          const resp = await fetch(env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
          deploy = resp.ok ? 'triggered' : `trigger_failed_${resp.status}`
        } catch {
          deploy = 'trigger_failed'
        }
      }

      const result: Record<string, unknown> = {
        ok: true,
        client: bizName,
        slug: bizSlug,
        steps_completed: stepsCompleted,
        wiki_pages: wikiPages,
        landing_pages_count: landingPagesCount,
        deploy,
        next_steps: [
          `Review content strategy at wiki:${bizSlug}-strategy`,
          'Check CRM for new contact',
        ],
      }

      if (warnings.length > 0) {
        result.warnings = warnings
      }

      return result
    },
  },
]
