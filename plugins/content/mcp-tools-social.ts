/**
 * post_social MCP tool — publish content to social media channels.
 *
 * Uses webhook-based delivery so it works with any automation platform:
 *   - Make.com (Integromat)
 *   - Zapier
 *   - n8n
 *   - Direct platform APIs
 *
 * The webhook receives a JSON payload with the post content and metadata.
 * Platform-specific formatting (thread splitting, image sizing) is handled
 * by the webhook receiver, not by Inkwell.
 *
 * Env vars:
 *   SOCIAL_WEBHOOK_URL — webhook endpoint that receives post payloads
 *   SOCIAL_WEBHOOK_TOKEN — optional Bearer token for webhook auth
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

const VALID_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'threads'] as const
type Platform = (typeof VALID_PLATFORMS)[number]

export const socialMcpTools: McpToolDef[] = [
  {
    name: 'post_social',
    description:
      'Post content to social media channels. Sends a structured payload to a webhook (Make.com, Zapier, n8n, or direct API). Supports Twitter/X, LinkedIn, Instagram, Facebook, YouTube, TikTok, and Threads.',
    inputSchema: {
      type: 'object',
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string', enum: VALID_PLATFORMS },
          description: 'Which platforms to post to (e.g. ["twitter", "linkedin"])',
        },
        text: { type: 'string', description: 'Post text/caption (required). Keep under 280 chars for Twitter.' },
        title: { type: 'string', description: 'Title/headline (used by LinkedIn articles, YouTube, etc.)' },
        url: { type: 'string', description: 'Link to include in the post' },
        image_url: { type: 'string', description: 'Image URL to attach' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags (without #, added automatically)' },
        schedule_at: { type: 'string', description: 'ISO 8601 datetime to schedule the post (omit for immediate)' },
        campaign: { type: 'string', description: 'Campaign name for tracking' },
      },
      required: ['platforms', 'text'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const webhookUrl = (env as Record<string, string>)['SOCIAL_WEBHOOK_URL']
      if (!webhookUrl) {
        return {
          error: 'social_not_configured',
          message: 'Set SOCIAL_WEBHOOK_URL env var to enable social posting. Use a Make.com/Zapier/n8n webhook URL.',
          setup_hint: 'npx wrangler secret put SOCIAL_WEBHOOK_URL',
        }
      }

      const platforms = (a.platforms as string[])?.filter(
        (p): p is Platform => VALID_PLATFORMS.includes(p as Platform),
      )
      if (!platforms?.length) return { error: 'platforms required', valid: [...VALID_PLATFORMS] }

      const text = typeof a.text === 'string' ? a.text.trim() : ''
      if (!text) return { error: 'text required' }

      const payload = {
        platforms,
        text,
        title: typeof a.title === 'string' ? a.title : undefined,
        url: typeof a.url === 'string' ? a.url : undefined,
        image_url: typeof a.image_url === 'string' ? a.image_url : undefined,
        hashtags: Array.isArray(a.hashtags)
          ? (a.hashtags as string[]).map(h => h.replace(/^#/, ''))
          : undefined,
        schedule_at: typeof a.schedule_at === 'string' ? a.schedule_at : undefined,
        campaign: typeof a.campaign === 'string' ? a.campaign : undefined,
        posted_at: new Date().toISOString(),
        source: 'inkwell',
      }

      const webhookToken = (env as Record<string, string>)['SOCIAL_WEBHOOK_TOKEN']
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (webhookToken) headers['Authorization'] = `Bearer ${webhookToken}`

      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          return {
            error: 'webhook_failed',
            status: res.status,
            message: `Webhook returned ${res.status}`,
          }
        }

        // Log the post to D1 for tracking
        await env.DB_ANALYTICS.prepare(
          'INSERT INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          `social-${Date.now()}`,
          payload.title ?? text.slice(0, 60),
          'social',
          'en',
          'agent',
          JSON.stringify(platforms),
          text.slice(0, 220),
          payload.posted_at.slice(0, 10),
          payload.posted_at.slice(0, 10),
          text.split(/\s+/).length,
          'social',
        ).run()

        return {
          ok: true,
          platforms,
          scheduled: !!payload.schedule_at,
          campaign: payload.campaign ?? null,
          text_length: text.length,
        }
      } catch {
        return { error: 'webhook_unreachable', message: 'Could not reach social webhook endpoint' }
      }
    },
  },
]
