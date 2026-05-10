import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/**
 * Content-tier fields — added to collections that support per-item access control.
 * See workers/inkwell-api/src/middleware/content-tier.ts for enforcement logic.
 */
const tierFields = {
  /** Five-tier access model. Defaults to 'public'. */
  tier: z.enum(['public', 'squad', 'project', 'entity', 'private']).default('public'),
  /** Required when tier = 'entity'. Must match entity_id claim in the session token. */
  entity_id: z.string().optional(),
  /** Tracks the creating agent/user ID. Required for tier = 'private' enforcement. */
  created_by: z.string().optional(),
  /** Optional role allowlist. If set, caller must have one of these roles regardless of tier. */
  permitted_roles: z.array(z.string()).optional(),
}

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Inkwell'),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    cover_image: z.string().optional(),
    cover_video: z.string().optional(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    toc: z.boolean().default(true),
    series: z.string().optional(),
    series_order: z.number().optional(),
    related: z.array(z.string()).default([]),
    newsletter: z.boolean().default(true),
    access: z.enum(['public', 'members', 'paid']).default('public'),
    topic: z.string().optional(),
    task_id: z.string().optional(),
    bounty: z.number().optional(),
    weight: z.number().default(5),
    connections: z.array(z.string()).default([]),
    contributors: z.array(z.string()).default([]),
    ...tierFields,
  }),
})

const books = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    cover_image: z.string().optional(),
    abstract: z.string().optional(),
    weight: z.number().default(5),
  }),
})

const topics = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['active', 'watching', 'archived']).default('active'),
    cover_image: z.string().optional(),
    our_take: z.string().optional(),
    tags: z.array(z.string()).default([]),
    sources: z.array(z.object({
      url: z.string(),
      title: z.string(),
      author: z.string().optional(),
      platform: z.enum(['youtube', 'x', 'tiktok', 'article', 'paper', 'github', 'podcast']),
      summary: z.string().optional(),
      added_by: z.string().optional(),
      added_date: z.coerce.date().optional(),
    })).default([]),
    voices: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
      url: z.string().optional(),
      platform: z.string().optional(),
    })).default([]),
    weekly_updates: z.array(z.object({
      title: z.string().optional(),
      summary: z.string(),
      date: z.coerce.date().optional(),
    })).default([]),
    updated: z.coerce.date(),
    weight: z.number().default(5),
  }),
})

const labs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/labs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['shipped', 'experiment', 'prototype', 'archived']).default('experiment'),
    repo: z.string().optional(),
    stack: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    cover_image: z.string().optional(),
    role_in_ecosystem: z.string().optional(),
    date: z.coerce.date(),
    weight: z.number().default(5),
  }),
})

const tools = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/tools' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['skill', 'plugin', 'mcp-server', 'sdk', 'integration']),
    install: z.string().optional(),
    repo: z.string().optional(),
    status: z.enum(['stable', 'beta', 'experimental']).default('beta'),
    tags: z.array(z.string()).default([]),
    agent_compatible: z.boolean().default(true),
    cover_image: z.string().optional(),
    date: z.coerce.date(),
    weight: z.number().default(5),
  }),
})

const team = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/team' }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    type: z.enum(['agent', 'human']).default('agent'),
    model: z.string().optional(),
    status: z.enum(['active', 'idle', 'dormant']).default('active'),
    squad: z.string().optional(),
    skills: z.array(z.string()).default([]),
    tasks_completed: z.number().default(0),
    avatar: z.string().optional(),
    born: z.coerce.date().optional(),
    origin: z.string().optional(),
    voice: z.string().optional(),
    socials: z.object({
      github: z.string().optional(),
      x: z.string().optional(),
    }).optional(),
  }),
})

const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/products' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    price: z.string().optional(),
    marketplace: z.enum(['codecanyon', 'ghl', 'wordpress', 'github', 'direct', 'mumega']).optional(),
    marketplace_url: z.string().optional(),
    cover_image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    status: z.enum(['available', 'coming-soon', 'discontinued']).default('available'),
    date: z.coerce.date(),
    weight: z.number().default(5),
  }),
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ...tierFields,
  }),
})

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(0),
    parent: z.string().optional(),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    ...tierFields,
  }),
})

export const collections = { blog, topics, labs, tools, team, products, pages, docs, books }
