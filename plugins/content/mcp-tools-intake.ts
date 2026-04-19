/**
 * business_intake MCP tool — the first thing an agent runs when onboarding a customer.
 *
 * Accepts structured business data and creates a wiki of interlinked content pages
 * stored in KV + indexed in D1. Produces:
 *   - wiki:business/overview — company profile
 *   - wiki:business/services — service catalog
 *   - wiki:business/audience — target audience personas
 *   - wiki:business/competitors — competitive landscape
 *   - wiki:business/brand — brand voice and positioning
 *   - wiki:business/channels — social/web presence
 *
 * All pages use [[wikilinks]] to cross-reference each other.
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

interface BusinessData {
  name: string
  industry?: string
  description?: string
  services?: string[]
  website?: string
  phone?: string
  email?: string
  address?: string
  target_audience?: string
  competitors?: string[]
  brand_voice?: string
  unique_value?: string
  social_accounts?: Record<string, string>
  goals?: string[]
  budget?: string
  notes?: string
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function storePage(env: Env, slug: string, title: string, content: string, tags: string[]): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  const description = content.replace(/[#*_>\-\[\]`]/g, ' ').trim().slice(0, 220)

  const frontmatter = [
    `title: "${title}"`,
    `date: "${date}"`,
    `author: "agent"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `description: "${description}"`,
    `status: "published"`,
    `type: "wiki"`,
  ].join('\n')

  const markdown = `---\n${frontmatter}\n---\n\n${content}`

  await env.CONTENT.put(`post:${slug}`, markdown)
  await env.CONTENT.put(`meta:${slug}`, JSON.stringify({ title, slug, author: 'agent', tags, description, date, status: 'published' }))

  await env.DB_ANALYTICS.prepare(
    'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(slug, title, 'wiki', 'en', 'agent', JSON.stringify(tags), description, date, date, content.split(/\s+/).length).run()
}

export const intakeMcpTools: McpToolDef[] = [
  {
    name: 'business_intake',
    description:
      'Gather business intelligence and build a structured wiki about a customer. This is the first tool to call when onboarding a new business. Creates interlinked wiki pages covering company profile, services, audience, competitors, brand voice, and channels.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Business name (required)' },
        industry: { type: 'string', description: 'Industry/sector' },
        description: { type: 'string', description: 'What the business does (2-3 sentences)' },
        services: { type: 'array', items: { type: 'string' }, description: 'List of services or products offered' },
        website: { type: 'string', description: 'Website URL' },
        phone: { type: 'string', description: 'Business phone' },
        email: { type: 'string', description: 'Business email' },
        address: { type: 'string', description: 'Physical address' },
        target_audience: { type: 'string', description: 'Who the business serves (demographics, needs, pain points)' },
        competitors: { type: 'array', items: { type: 'string' }, description: 'Known competitors' },
        brand_voice: { type: 'string', description: 'Brand tone and personality (e.g. professional, friendly, bold)' },
        unique_value: { type: 'string', description: 'Unique value proposition — what makes them different' },
        social_accounts: {
          type: 'object',
          description: 'Social media handles: { twitter, linkedin, instagram, facebook, youtube, tiktok }',
        },
        goals: { type: 'array', items: { type: 'string' }, description: 'Business goals for the next 3-6 months' },
        budget: { type: 'string', description: 'Monthly marketing budget range' },
        notes: { type: 'string', description: 'Any other relevant info' },
      },
      required: ['name'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      const biz = a as unknown as BusinessData

      if (!biz.name?.trim()) return { error: 'name required' }

      const bizSlug = slugify(biz.name)
      const tags = ['wiki', 'business', bizSlug]
      const pages: string[] = []

      // 1. Overview page
      const overviewLines = [
        `# ${biz.name}`,
        '',
        biz.description || `Business profile for ${biz.name}.`,
        '',
        '## Quick Facts',
        '',
        biz.industry ? `- **Industry:** ${biz.industry}` : null,
        biz.website ? `- **Website:** ${biz.website}` : null,
        biz.phone ? `- **Phone:** ${biz.phone}` : null,
        biz.email ? `- **Email:** ${biz.email}` : null,
        biz.address ? `- **Address:** ${biz.address}` : null,
        biz.unique_value ? `- **Value Prop:** ${biz.unique_value}` : null,
        biz.budget ? `- **Marketing Budget:** ${biz.budget}` : null,
        '',
        '## Wiki',
        '',
        biz.services?.length ? `- [[${bizSlug}-services|Services]]` : null,
        biz.target_audience ? `- [[${bizSlug}-audience|Target Audience]]` : null,
        biz.competitors?.length ? `- [[${bizSlug}-competitors|Competitors]]` : null,
        biz.brand_voice ? `- [[${bizSlug}-brand|Brand Voice]]` : null,
        biz.social_accounts ? `- [[${bizSlug}-channels|Channels]]` : null,
        biz.goals?.length ? `- [[${bizSlug}-goals|Goals]]` : null,
      ].filter(Boolean).join('\n')

      await storePage(env, `${bizSlug}-overview`, `${biz.name} — Overview`, overviewLines, tags)
      pages.push(`${bizSlug}-overview`)

      // 2. Services page
      if (biz.services?.length) {
        const servicesContent = [
          `# ${biz.name} — Services`,
          '',
          `Services offered by [[${bizSlug}-overview|${biz.name}]]:`,
          '',
          ...biz.services.map(s => `- **${s}**`),
          '',
          `See also: [[${bizSlug}-audience|Target Audience]], [[${bizSlug}-competitors|Competitors]]`,
        ].join('\n')

        await storePage(env, `${bizSlug}-services`, `${biz.name} — Services`, servicesContent, [...tags, 'services'])
        pages.push(`${bizSlug}-services`)
      }

      // 3. Audience page
      if (biz.target_audience) {
        const audienceContent = [
          `# ${biz.name} — Target Audience`,
          '',
          biz.target_audience,
          '',
          `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-services|Services]]`,
        ].join('\n')

        await storePage(env, `${bizSlug}-audience`, `${biz.name} — Target Audience`, audienceContent, [...tags, 'audience'])
        pages.push(`${bizSlug}-audience`)
      }

      // 4. Competitors page
      if (biz.competitors?.length) {
        const competitorsContent = [
          `# ${biz.name} — Competitive Landscape`,
          '',
          `Known competitors for [[${bizSlug}-overview|${biz.name}]]:`,
          '',
          ...biz.competitors.map(c => `- **${c}**`),
          '',
          `See also: [[${bizSlug}-services|Services]], [[${bizSlug}-audience|Target Audience]]`,
        ].join('\n')

        await storePage(env, `${bizSlug}-competitors`, `${biz.name} — Competitors`, competitorsContent, [...tags, 'competitors'])
        pages.push(`${bizSlug}-competitors`)
      }

      // 5. Brand voice page
      if (biz.brand_voice) {
        const brandContent = [
          `# ${biz.name} — Brand Voice`,
          '',
          `Brand voice and positioning for [[${bizSlug}-overview|${biz.name}]]:`,
          '',
          biz.brand_voice,
          '',
          biz.unique_value ? `## Unique Value Proposition\n\n${biz.unique_value}` : '',
          '',
          `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-channels|Channels]]`,
        ].filter(Boolean).join('\n')

        await storePage(env, `${bizSlug}-brand`, `${biz.name} — Brand Voice`, brandContent, [...tags, 'brand'])
        pages.push(`${bizSlug}-brand`)
      }

      // 6. Channels page
      if (biz.social_accounts && Object.keys(biz.social_accounts).length > 0) {
        const channelLines = Object.entries(biz.social_accounts)
          .filter(([, v]) => v)
          .map(([platform, handle]) => `- **${platform}:** ${handle}`)

        const channelsContent = [
          `# ${biz.name} — Channels`,
          '',
          `Online presence for [[${bizSlug}-overview|${biz.name}]]:`,
          '',
          biz.website ? `- **Website:** ${biz.website}` : '',
          ...channelLines,
          '',
          `See also: [[${bizSlug}-brand|Brand Voice]], [[${bizSlug}-audience|Target Audience]]`,
        ].filter(Boolean).join('\n')

        await storePage(env, `${bizSlug}-channels`, `${biz.name} — Channels`, channelsContent, [...tags, 'channels'])
        pages.push(`${bizSlug}-channels`)
      }

      // 7. Goals page
      if (biz.goals?.length) {
        const goalsContent = [
          `# ${biz.name} — Goals`,
          '',
          `Business goals for [[${bizSlug}-overview|${biz.name}]]:`,
          '',
          ...biz.goals.map((g, i) => `${i + 1}. ${g}`),
          '',
          biz.notes ? `## Notes\n\n${biz.notes}` : '',
          '',
          `See also: [[${bizSlug}-overview|Overview]], [[${bizSlug}-services|Services]]`,
        ].filter(Boolean).join('\n')

        await storePage(env, `${bizSlug}-goals`, `${biz.name} — Goals`, goalsContent, [...tags, 'goals'])
        pages.push(`${bizSlug}-goals`)
      }

      return {
        ok: true,
        business: biz.name,
        slug: bizSlug,
        pages_created: pages.length,
        pages,
        next_step: 'Call content_strategy to generate a prioritized marketing plan based on this wiki.',
      }
    },
  },
]
