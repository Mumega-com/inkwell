/**
 * content_strategy MCP tool — analyze business wiki and generate a prioritized plan.
 *
 * Reads the wiki pages created by business_intake and generates:
 *   - Content calendar priorities
 *   - SEO keyword targets based on services + audience
 *   - Social media posting cadence
 *   - Quick wins vs long-term plays
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const strategyMcpTools: McpToolDef[] = [
  {
    name: 'content_strategy',
    description:
      'Analyze a business wiki (created by business_intake) and generate a prioritized marketing strategy. Returns content topics, SEO targets, social cadence, and quick wins.',
    inputSchema: {
      type: 'object',
      properties: {
        business_slug: { type: 'string', description: 'Business slug from business_intake (required)' },
        focus: {
          type: 'string',
          enum: ['seo', 'social', 'content', 'ads', 'all'],
          description: 'Which area to focus on (default: all)',
        },
        timeframe: {
          type: 'string',
          enum: ['30d', '60d', '90d'],
          description: 'Planning timeframe (default: 30d)',
        },
      },
      required: ['business_slug'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const bizSlug = typeof a.business_slug === 'string' ? a.business_slug.trim() : ''
      if (!bizSlug) return { error: 'business_slug required' }

      const focus = typeof a.focus === 'string' ? a.focus : 'all'
      const timeframe = typeof a.timeframe === 'string' ? a.timeframe : '30d'

      // Read the business wiki pages
      const overviewRaw = await env.CONTENT.get(`post:${bizSlug}-overview`)
      if (!overviewRaw) {
        return { error: 'business_not_found', hint: 'Run business_intake first to create the wiki.' }
      }

      const servicesRaw = await env.CONTENT.get(`post:${bizSlug}-services`)
      const audienceRaw = await env.CONTENT.get(`post:${bizSlug}-audience`)
      const competitorsRaw = await env.CONTENT.get(`post:${bizSlug}-competitors`)
      const brandRaw = await env.CONTENT.get(`post:${bizSlug}-brand`)
      const channelsRaw = await env.CONTENT.get(`post:${bizSlug}-channels`)
      const goalsRaw = await env.CONTENT.get(`post:${bizSlug}-goals`)

      // Extract service names from the services page
      const services: string[] = []
      if (servicesRaw) {
        const matches = servicesRaw.match(/\*\*([^*]+)\*\*/g)
        if (matches) services.push(...matches.map(m => m.replace(/\*\*/g, '')))
      }

      // Extract competitor names
      const competitors: string[] = []
      if (competitorsRaw) {
        const matches = competitorsRaw.match(/\*\*([^*]+)\*\*/g)
        if (matches) competitors.push(...matches.map(m => m.replace(/\*\*/g, '')))
      }

      // Extract social platforms
      const socialPlatforms: string[] = []
      if (channelsRaw) {
        const platformMatches = channelsRaw.match(/\*\*(\w+):\*\*/g)
        if (platformMatches) socialPlatforms.push(...platformMatches.map(m => m.replace(/\*\*|:/g, '').toLowerCase()))
      }

      // Extract goals
      const goals: string[] = []
      if (goalsRaw) {
        const goalMatches = goalsRaw.match(/\d+\.\s+(.+)/g)
        if (goalMatches) goals.push(...goalMatches.map(m => m.replace(/^\d+\.\s+/, '')))
      }

      // Build strategy
      const strategy: Record<string, unknown> = {
        business: bizSlug,
        focus,
        timeframe,
      }

      // SEO strategy
      if (focus === 'all' || focus === 'seo') {
        const seoTopics = services.flatMap(service => [
          `${service} — what it is and who needs it`,
          `${service} — vs competitors comparison`,
          `${service} — case study / results`,
          `best ${service} in [city/region]`,
          `how to choose a ${service} provider`,
        ])

        strategy.seo = {
          priority: 'high',
          keyword_targets: services.map(s => s.toLowerCase()),
          content_topics: seoTopics.slice(0, 15),
          quick_wins: [
            'Publish service pages with schema markup for each service',
            'Create a FAQ page targeting long-tail keywords',
            'Set up Google Business Profile if not done',
            'Add meta descriptions to all existing pages',
          ],
        }
      }

      // Content strategy
      if (focus === 'all' || focus === 'content') {
        const contentPlan = []

        // Service-based content
        for (const service of services.slice(0, 5)) {
          contentPlan.push({
            type: 'blog',
            topic: `Complete Guide to ${service}`,
            priority: 'high',
            seo_value: 'pillar page',
          })
        }

        // Competitor comparison content
        for (const comp of competitors.slice(0, 3)) {
          contentPlan.push({
            type: 'blog',
            topic: `${bizSlug} vs ${comp} — honest comparison`,
            priority: 'medium',
            seo_value: 'comparison keyword',
          })
        }

        // Trust-building content
        contentPlan.push(
          { type: 'page', topic: 'About Us — team and story', priority: 'high', seo_value: 'trust' },
          { type: 'page', topic: 'Testimonials / Case Studies', priority: 'high', seo_value: 'social proof' },
          { type: 'blog', topic: 'FAQ — common questions answered', priority: 'medium', seo_value: 'long-tail' },
        )

        strategy.content = {
          priority: 'high',
          plan: contentPlan,
          cadence: timeframe === '30d' ? '2 posts/week' : '3 posts/week',
        }
      }

      // Social strategy
      if (focus === 'all' || focus === 'social') {
        strategy.social = {
          priority: socialPlatforms.length > 0 ? 'medium' : 'low',
          active_platforms: socialPlatforms,
          recommended_platforms: services.length > 0
            ? ['linkedin', 'instagram', 'facebook']
            : ['twitter', 'linkedin'],
          cadence: {
            twitter: '1-2 posts/day',
            linkedin: '3-4 posts/week',
            instagram: '4-5 posts/week',
            facebook: '3-4 posts/week',
          },
          content_mix: {
            educational: '40%',
            promotional: '20%',
            engagement: '20%',
            social_proof: '20%',
          },
          quick_wins: [
            'Repurpose each blog post into 3-5 social posts',
            'Share customer testimonials weekly',
            'Post behind-the-scenes content',
          ],
        }
      }

      // Ads strategy
      if (focus === 'all' || focus === 'ads') {
        strategy.ads = {
          priority: 'medium',
          recommended_channels: ['google_search', 'google_local', 'meta_ads'],
          keyword_themes: services.map(s => s.toLowerCase()),
          budget_allocation: {
            google_search: '50%',
            google_local: '20%',
            meta_retargeting: '30%',
          },
          quick_wins: [
            'Set up Google Ads brand campaign (protect brand name)',
            'Create Meta retargeting pixel on website',
            'Launch Google Local Services ads if eligible',
          ],
        }
      }

      // Overall priorities
      const weeks = timeframe === '30d' ? 4 : timeframe === '60d' ? 8 : 12
      strategy.execution_order = [
        { week: '1', tasks: ['Publish service pages', 'Set up Google Business Profile', 'Install tracking pixels'] },
        { week: '2', tasks: ['Write first 2 blog posts', 'Set up social accounts', 'Launch brand search campaign'] },
        { week: '3-4', tasks: ['Publish case studies', 'Start social posting cadence', 'Set up retargeting'] },
      ]

      if (weeks > 4) {
        strategy.execution_order.push(
          { week: '5-8', tasks: ['Scale content to 3/week', 'Optimize ad campaigns', 'Build email list'] },
        )
      }

      strategy.goals_alignment = goals.length > 0
        ? goals.map(g => ({ goal: g, supporting_actions: 'Covered by the plan above' }))
        : [{ goal: 'Grow online presence', supporting_actions: 'SEO + content + social cadence' }]

      // Store the strategy as a wiki page
      const strategyContent = [
        `# ${bizSlug} — Marketing Strategy (${timeframe})`,
        '',
        `Generated for [[${bizSlug}-overview|${bizSlug}]] on ${new Date().toISOString().slice(0, 10)}.`,
        '',
        `Focus: **${focus}** | Timeframe: **${timeframe}**`,
        '',
        '## Execution Order',
        '',
        ...(strategy.execution_order as Array<{ week: string; tasks: string[] }>).map(
          w => `### Week ${w.week}\n${w.tasks.map(t => `- ${t}`).join('\n')}`,
        ),
      ].join('\n')

      await env.CONTENT.put(`post:${bizSlug}-strategy`, strategyContent)
      await env.CONTENT.put(`meta:${bizSlug}-strategy`, JSON.stringify({
        title: `${bizSlug} — Strategy`,
        slug: `${bizSlug}-strategy`,
        author: 'agent',
        tags: ['wiki', 'strategy', bizSlug],
        date: new Date().toISOString().slice(0, 10),
        status: 'published',
      }))

      // Trigger deploy hook so strategy page goes live
      if (env.CF_PAGES_DEPLOY_HOOK) {
        try {
          await fetch(env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
        } catch {
          // deploy hook is best-effort
        }
      }

      return strategy
    },
  },
]
