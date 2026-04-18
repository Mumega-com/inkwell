import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const discoveryRoutes = new Hono<AppBindings>()

// ── Types ────────────────────────────────────────────────────────────────────

interface DiscoveryAnswers {
  // Section 1: About Your Business
  business_name: string
  industry: string
  years_in_business: string
  team_size: string
  monthly_revenue: string

  // Section 2: Digital Presence
  has_website: string
  website_platform: string
  google_business_profile: string
  social_media: string[]
  paid_ads: string
  has_crm: string

  // Section 3: Skills & Resources
  can_write_content: string
  can_record_video: string
  understands_analytics: string
  can_manage_social: string
  marketing_budget: string
  biggest_challenge: string

  // Section 4: Goals
  primary_goal: string
  timeline: string
  ideal_customer: string
  differentiator: string
  how_customers_find_you: string[]
}

interface DimensionScores {
  digital_foundation: number
  content_capability: number
  data_maturity: number
  growth_readiness: number
  market_position: number
}

interface ModuleDefinition {
  slug: string
  title: string
  description: string
  category: 'FOUNDATION' | 'CONTENT' | 'ACQUISITION' | 'OPTIMIZATION' | 'SCALE'
  week: number
}

// ── Module Library ───────────────────────────────────────────────────────────

const MODULES: ModuleDefinition[] = [
  // FOUNDATION
  {
    slug: 'setup-website',
    title: 'Launch or optimize your website',
    description: 'Build a fast, conversion-ready website that ranks in Google and turns visitors into leads.',
    category: 'FOUNDATION',
    week: 1,
  },
  {
    slug: 'setup-gbp',
    title: 'Claim and optimize Google Business Profile',
    description: 'Get found in local searches and Google Maps. Complete profile setup, photos, and first reviews.',
    category: 'FOUNDATION',
    week: 1,
  },
  {
    slug: 'setup-tracking',
    title: 'Install GA4 + conversion tracking',
    description: 'Know what\'s working. Set up Google Analytics 4, Search Console, and track your first conversions.',
    category: 'FOUNDATION',
    week: 2,
  },
  {
    slug: 'setup-crm',
    title: 'Set up lead tracking',
    description: 'Stop losing leads in your inbox. Set up a simple CRM so every inquiry gets followed up.',
    category: 'FOUNDATION',
    week: 2,
  },

  // CONTENT
  {
    slug: 'first-seo-pages',
    title: 'Write 3 pages that rank',
    description: 'Create your service pages with the right keywords so customers find you in Google search.',
    category: 'CONTENT',
    week: 3,
  },
  {
    slug: 'social-setup',
    title: 'Set up and optimize social profiles',
    description: 'Create professional social profiles that build trust and drive traffic back to your site.',
    category: 'CONTENT',
    week: 3,
  },
  {
    slug: 'content-calendar',
    title: 'Create a 30-day content calendar',
    description: 'Plan and batch 30 days of social content in a single session. No more staring at a blank screen.',
    category: 'CONTENT',
    week: 4,
  },
  {
    slug: 'first-video',
    title: 'Record your first business video',
    description: 'One 60-second video of you talking about your business builds more trust than 10 text posts.',
    category: 'CONTENT',
    week: 4,
  },

  // ACQUISITION
  {
    slug: 'google-ads-start',
    title: 'Launch your first Google Ads campaign',
    description: 'Get in front of people actively searching for what you sell. Start with a $300 test budget.',
    category: 'ACQUISITION',
    week: 5,
  },
  {
    slug: 'facebook-retargeting',
    title: 'Set up retargeting for website visitors',
    description: 'Show ads to people who already visited your site. Highest ROI of any ad channel.',
    category: 'ACQUISITION',
    week: 6,
  },
  {
    slug: 'email-list',
    title: 'Build your first email list',
    description: 'Create a lead magnet and capture form. Email is still the highest-converting channel.',
    category: 'ACQUISITION',
    week: 5,
  },
  {
    slug: 'cold-outreach',
    title: 'Start systematic outreach (100/day)',
    description: 'Build a repeatable outbound system to fill your pipeline without waiting for referrals.',
    category: 'ACQUISITION',
    week: 6,
  },

  // OPTIMIZATION
  {
    slug: 'seo-audit',
    title: 'Audit and fix your top 10 pages',
    description: 'Find and fix the technical issues stopping your pages from ranking higher in Google.',
    category: 'OPTIMIZATION',
    week: 7,
  },
  {
    slug: 'conversion-optimization',
    title: 'Improve your forms and CTAs',
    description: 'Small changes to your headlines, buttons, and forms can double your lead rate.',
    category: 'OPTIMIZATION',
    week: 7,
  },
  {
    slug: 'review-campaign',
    title: 'Collect 20 Google reviews',
    description: 'Reviews are the #1 trust signal for local businesses. Build a system to collect them consistently.',
    category: 'OPTIMIZATION',
    week: 8,
  },
  {
    slug: 'referral-system',
    title: 'Build a referral program',
    description: 'Turn your best customers into your best salespeople with a simple, structured referral offer.',
    category: 'OPTIMIZATION',
    week: 8,
  },

  // SCALE
  {
    slug: 'hire-first-tool',
    title: 'Replace manual work with automation',
    description: 'Identify the 3 tasks eating the most time and automate them so you can focus on growth.',
    category: 'SCALE',
    week: 9,
  },
  {
    slug: 'expand-channels',
    title: 'Add a new marketing channel',
    description: 'Once your core channel works, add a second. Double the touchpoints, multiply the results.',
    category: 'SCALE',
    week: 10,
  },
  {
    slug: 'raise-prices',
    title: 'Increase prices with confidence',
    description: 'Use positioning, testimonials, and reframing to charge what you\'re actually worth.',
    category: 'SCALE',
    week: 11,
  },
  {
    slug: 'systemize',
    title: 'Document your marketing system',
    description: 'Write down everything so your marketing runs with or without you every day.',
    category: 'SCALE',
    week: 12,
  },
]

// ── Scoring Engine ───────────────────────────────────────────────────────────

function scoreDigitalFoundation(a: DiscoveryAnswers): number {
  let score = 0

  // Website (0-35)
  if (a.has_website === 'yes_ecommerce') score += 35
  else if (a.has_website === 'yes_seo') score += 30
  else if (a.has_website === 'yes_basic') score += 15
  // No website = 0

  // Google Business Profile (0-35)
  if (a.google_business_profile === 'yes_optimized') score += 35
  else if (a.google_business_profile === 'yes_not_optimized') score += 15
  else if (a.google_business_profile === 'dont_know') score += 5
  // No GBP = 0

  // CRM (0-30)
  if (['ghl', 'hubspot', 'salesforce'].includes(a.has_crm)) score += 30
  else if (a.has_crm === 'other') score += 20
  else if (a.has_crm === 'spreadsheet') score += 10
  // No CRM = 0

  return Math.min(100, score)
}

function scoreContentCapability(a: DiscoveryAnswers): number {
  let score = 0

  // Writing (0-35)
  if (a.can_write_content === 'yes_regularly') score += 35
  else if (a.can_write_content === 'sometimes') score += 20
  // No = 0

  // Video (0-35)
  if (a.can_record_video === 'comfortable') score += 35
  else if (a.can_record_video === 'basic') score += 20
  else if (a.can_record_video === 'never_tried') score += 5

  // Social media consistency (0-30)
  if (a.can_manage_social === 'consistent') score += 30
  else if (a.can_manage_social === 'occasionally') score += 15
  // No time = 0

  return Math.min(100, score)
}

function scoreDataMaturity(a: DiscoveryAnswers): number {
  let score = 0

  // Analytics understanding (0-60)
  if (a.understands_analytics === 'make_decisions') score += 60
  else if (a.understands_analytics === 'check_weekly') score += 40
  else if (a.understands_analytics === 'ive_looked') score += 15
  // "What's that" = 0

  // Website with tracking signals data maturity (0-20)
  if (a.has_website === 'yes_seo' || a.has_website === 'yes_ecommerce') score += 20
  else if (a.has_website === 'yes_basic') score += 5

  // Paid ads implies tracking (0-20)
  if (a.paid_ads === 'currently_running') score += 20
  else if (a.paid_ads === 'tried_and_stopped') score += 10

  return Math.min(100, score)
}

function scoreGrowthReadiness(a: DiscoveryAnswers): number {
  let score = 0

  // Budget (0-40)
  if (a.marketing_budget === '2000_plus') score += 40
  else if (a.marketing_budget === '500_2000') score += 30
  else if (a.marketing_budget === 'under_500') score += 15
  // $0 = 0

  // Team size (0-30)
  if (a.team_size === '20_plus') score += 30
  else if (a.team_size === '6_20') score += 20
  else if (a.team_size === '2_5') score += 10
  // Just me = 5
  else score += 5

  // Revenue (0-30)
  if (a.monthly_revenue === '200k_plus') score += 30
  else if (a.monthly_revenue === '50k_200k') score += 25
  else if (a.monthly_revenue === '10k_50k') score += 15
  else if (a.monthly_revenue === 'under_10k') score += 8
  // Pre-revenue = 0

  return Math.min(100, score)
}

function scoreMarketPosition(a: DiscoveryAnswers): number {
  let score = 0

  // Years in business (0-30)
  if (a.years_in_business === '10_plus') score += 30
  else if (a.years_in_business === '3_10') score += 20
  else if (a.years_in_business === '1_3') score += 10
  // 0-1 = 5
  else score += 5

  // Has a clear differentiator (0-40)
  const diff = (a.differentiator ?? '').trim()
  if (diff.length > 80) score += 40
  else if (diff.length > 30) score += 25
  else if (diff.length > 5) score += 10

  // Knows their customer (0-30)
  const customer = (a.ideal_customer ?? '').trim()
  if (customer.length > 80) score += 30
  else if (customer.length > 30) score += 20
  else if (customer.length > 5) score += 10

  return Math.min(100, score)
}

function selectModules(scores: DimensionScores, answers: DiscoveryAnswers): ModuleDefinition[] {
  const selected: ModuleDefinition[] = []
  const add = (slug: string) => {
    const mod = MODULES.find(m => m.slug === slug)
    if (mod && !selected.find(s => s.slug === slug)) selected.push(mod)
  }

  // Foundation gaps — must fix first
  if (answers.has_website === 'no') add('setup-website')
  if (answers.google_business_profile === 'no' || answers.google_business_profile === 'dont_know') add('setup-gbp')
  if (scores.digital_foundation < 30) {
    add('setup-website')
    add('setup-gbp')
    add('setup-crm')
    add('setup-tracking')
  } else if (scores.digital_foundation < 60) {
    if (answers.google_business_profile !== 'yes_optimized') add('setup-gbp')
    if (!['ghl', 'hubspot', 'salesforce', 'other'].includes(answers.has_crm)) add('setup-crm')
    if (scores.data_maturity < 30) add('setup-tracking')
  }

  // Data gap
  if (scores.data_maturity < 30) {
    add('setup-tracking')
  }

  // Content gaps
  if (scores.content_capability < 40) {
    if (answers.can_write_content !== 'no') add('first-seo-pages')
    if (answers.can_record_video !== 'never_tried') add('first-video')
    add('social-setup')
    add('content-calendar')
  } else if (scores.content_capability < 70) {
    add('content-calendar')
    add('first-seo-pages')
    if (answers.social_media.length === 0 || (answers.social_media.length === 1 && answers.social_media[0] === 'none')) {
      add('social-setup')
    }
  }

  // Acquisition — add based on budget and goal
  const wantsLeads = answers.primary_goal === 'more_leads' || answers.primary_goal === 'more_sales'
  const hasBudget = ['under_500', '500_2000', '2000_plus'].includes(answers.marketing_budget)

  if (wantsLeads) {
    if (hasBudget && answers.marketing_budget !== 'under_500') {
      add('google-ads-start')
      if (scores.digital_foundation >= 40) add('facebook-retargeting')
    }
    add('email-list')
    if (answers.primary_goal === 'more_leads') add('cold-outreach')
  }

  // Optimization — add if they have a foundation
  if (scores.digital_foundation >= 40) {
    add('review-campaign')
    if (scores.data_maturity >= 30) add('seo-audit')
    add('conversion-optimization')
  }

  // Referral if they have customers
  if (answers.monthly_revenue !== 'pre_revenue' && answers.how_customers_find_you.includes('word_of_mouth')) {
    add('referral-system')
  }

  // Scale — only if ready
  if (scores.growth_readiness >= 50 || answers.timeline === 'long_term') {
    add('hire-first-tool')
    add('expand-channels')
  }
  if (scores.market_position >= 60) {
    add('raise-prices')
    add('systemize')
  }

  // Ensure 8-12 modules
  if (selected.length < 8) {
    const fallbacks = ['setup-tracking', 'content-calendar', 'first-seo-pages', 'review-campaign', 'email-list', 'social-setup', 'conversion-optimization', 'referral-system']
    for (const slug of fallbacks) {
      if (selected.length >= 8) break
      add(slug)
    }
  }

  return selected.slice(0, 12)
}

function assignWeeks(modules: ModuleDefinition[]): (ModuleDefinition & { assigned_week: number })[] {
  // Re-number weeks so they flow 1 → 12 in logical order
  const categoryOrder: Record<string, number> = {
    FOUNDATION: 1,
    CONTENT: 3,
    ACQUISITION: 5,
    OPTIMIZATION: 7,
    SCALE: 10,
  }

  const sorted = [...modules].sort((a, b) => {
    const ao = categoryOrder[a.category] ?? 99
    const bo = categoryOrder[b.category] ?? 99
    if (ao !== bo) return ao - bo
    return a.week - b.week
  })

  // Assign sequential 2-week windows per category batch
  let currentWeek = 1
  let lastCategory = ''
  return sorted.map((m) => {
    if (m.category !== lastCategory) {
      if (lastCategory) currentWeek += 2
      lastCategory = m.category
    }
    const assigned_week = currentWeek
    return { ...m, assigned_week }
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Grant Eligibility (lightweight rules from GAF) ─────────────────────────

interface GrantEligibility {
  slug: string
  name: string
  maxAmount: number
  reason: string
  applyUrl: string
}

function evaluateGrantEligibility(answers: DiscoveryAnswers): GrantEligibility[] {
  const grants: GrantEligibility[] = []
  const industry = answers.industry?.toLowerCase() ?? ''
  const revenue = answers.monthly_revenue ?? ''
  const teamSize = answers.team_size ?? ''
  const province = 'ON' // default for now, add to quiz later

  // DMAP — any SMB under 500 employees
  if (teamSize !== '20+' || true) { // most qualify
    grants.push({
      slug: 'dmap',
      name: 'DMAP Digital Adoption Plan',
      maxAmount: 15000,
      reason: 'SMBs with under 500 employees qualify for up to $15,000 toward a digital adoption plan.',
      applyUrl: 'https://example.com/apply',
    })
  }

  // SR&ED — any company doing R&D, software dev, engineering
  if (['technology', 'manufacturing', 'other'].includes(industry)) {
    grants.push({
      slug: 'sred',
      name: 'SR&ED Tax Credit',
      maxAmount: 500000,
      reason: 'Your industry likely involves experimental development or technical problem-solving that qualifies.',
      applyUrl: 'https://example.com/apply',
    })
  }

  // AMIC — Ontario manufacturers
  if (industry === 'manufacturing') {
    grants.push({
      slug: 'amic',
      name: 'AMIC Ontario',
      maxAmount: 1500000,
      reason: 'Ontario manufacturers can access up to $1.5M for equipment, automation, and process improvement.',
      applyUrl: 'https://example.com/apply',
    })
  }

  // CanExport — any business with international activity
  if (industry === 'freight/logistics' || revenue === '$50K-200K' || revenue === '$200K+') {
    grants.push({
      slug: 'canexport',
      name: 'CanExport',
      maxAmount: 75000,
      reason: 'Businesses exploring international markets can get up to $75K for export development.',
      applyUrl: 'https://example.com/apply',
    })
  }

  // NRC IRAP — innovative SMEs
  if (['technology', 'manufacturing'].includes(industry) && teamSize !== 'Just me') {
    grants.push({
      slug: 'irap',
      name: 'NRC IRAP',
      maxAmount: 500000,
      reason: 'Innovative SMEs can access up to $500K for R&D projects through the Industrial Research Assistance Program.',
      applyUrl: 'https://example.com/apply',
    })
  }

  return grants
}

// ── POST /api/discovery/submit ───────────────────────────────────────────────

discoveryRoutes.post('/submit', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const answers = body as DiscoveryAnswers

  if (!answers.business_name || typeof answers.business_name !== 'string') {
    return c.json({ error: 'business_name required' }, 400)
  }

  // Score all 5 dimensions
  const dimensions: DimensionScores = {
    digital_foundation: scoreDigitalFoundation(answers),
    content_capability: scoreContentCapability(answers),
    data_maturity: scoreDataMaturity(answers),
    growth_readiness: scoreGrowthReadiness(answers),
    market_position: scoreMarketPosition(answers),
  }

  const readinessScore = Math.round(
    (dimensions.digital_foundation * 0.25) +
    (dimensions.content_capability * 0.20) +
    (dimensions.data_maturity * 0.20) +
    (dimensions.growth_readiness * 0.20) +
    (dimensions.market_position * 0.15)
  )

  // Grant eligibility scan (lightweight rules, inspired by GAF's 27-program engine)
  const grants = evaluateGrantEligibility(answers)

  // Select and order modules
  const rawModules = selectModules(dimensions, answers)

  // Inject grant-related steps if eligible
  if (grants.length > 0) {
    rawModules.push({
      slug: 'apply-grants',
      title: `Apply for ${grants.length} grant program${grants.length > 1 ? 's' : ''} — up to $${grants.reduce((sum, g) => sum + g.maxAmount, 0).toLocaleString()}`,
      description: `You're eligible for: ${grants.map(g => g.name).join(', ')}. We help you apply.`,
      category: 'FOUNDATION',
      week: 2,
    })
  }

  const orderedModules = assignWeeks(rawModules)

  // Persist business profile
  const profileId = generateId()
  const planId = generateId()
  const now = new Date().toISOString()

  const db = c.get('db_core')

  await db.execute(
    `INSERT INTO business_profiles (id, business_name, industry, answers, scores, readiness_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [profileId, answers.business_name.trim(), answers.industry ?? '', JSON.stringify(answers), JSON.stringify(dimensions), readinessScore, now]
  )

  // Persist plan
  await db.execute(
    `INSERT INTO business_plans (id, profile_id, title, total_steps, completed_steps, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [planId, profileId, '90-Day Growth Plan', orderedModules.length, 0, 'active', now]
  )

  // Persist steps — first available, rest locked
  const stepInserts = orderedModules.map((mod, idx) => {
    const stepId = generateId()
    const status = idx === 0 ? 'available' : 'locked'
    return db.execute(
      `INSERT INTO plan_steps (id, plan_id, module_slug, title, description, week, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [stepId, planId, mod.slug, mod.title, mod.description, mod.assigned_week, idx, status]
    )
  })

  await Promise.all(stepInserts)

  const steps = orderedModules.map((mod, idx) => ({
    module_slug: mod.slug,
    title: mod.title,
    description: mod.description,
    week: mod.assigned_week,
    category: mod.category,
    order_index: idx,
    status: idx === 0 ? 'available' : 'locked',
  }))

  return c.json({
    planId,
    profileId,
    readinessScore,
    dimensions,
    steps,
    grants,
    totalGrantValue: grants.reduce((sum, g) => sum + g.maxAmount, 0),
    businessName: answers.business_name.trim(),
  })
})

// ── GET /api/discovery/plan/:planId ─────────────────────────────────────────

discoveryRoutes.get('/plan/:planId', async (c) => {
  const planId = c.req.param('planId')

  const db = c.get('db_core')

  const plan = await db.queryOne<{
    id: string
    profile_id: string
    title: string
    total_steps: number
    completed_steps: number
    status: string
    created_at: string
    business_name: string
    industry: string
    scores: string
    readiness_score: number
  }>(
    `SELECT bp.*, bpr.business_name, bpr.industry, bpr.scores, bpr.readiness_score
     FROM business_plans bp
     JOIN business_profiles bpr ON bpr.id = bp.profile_id
     WHERE bp.id = ?`,
    [planId]
  )

  if (!plan) return c.json({ error: 'plan not found' }, 404)

  const steps = await db.query<{
    id: string
    module_slug: string
    title: string
    description: string
    week: number
    order_index: number
    status: string
    completed_at: string | null
  }>(
    `SELECT id, module_slug, title, description, week, order_index, status, completed_at
     FROM plan_steps
     WHERE plan_id = ?
     ORDER BY order_index ASC`,
    [planId]
  )

  const scores: DimensionScores = typeof plan.scores === 'string'
    ? JSON.parse(plan.scores)
    : (plan.scores as unknown as DimensionScores)

  const progressPercent = plan.total_steps > 0
    ? Math.round((plan.completed_steps / plan.total_steps) * 100)
    : 0

  // Estimate completion date (13 weeks from creation)
  const startDate = new Date(plan.created_at)
  const estimatedEnd = new Date(startDate)
  estimatedEnd.setDate(estimatedEnd.getDate() + 91)

  return c.json({
    id: plan.id,
    title: plan.title,
    businessName: plan.business_name,
    industry: plan.industry,
    readinessScore: plan.readiness_score,
    dimensions: scores,
    totalSteps: plan.total_steps,
    completedSteps: plan.completed_steps,
    progressPercent,
    status: plan.status,
    createdAt: plan.created_at,
    estimatedCompletionDate: estimatedEnd.toISOString().slice(0, 10),
    steps,
  })
})

// ── POST /api/discovery/plan/:planId/complete-step ───────────────────────────

discoveryRoutes.post('/plan/:planId/complete-step', async (c) => {
  const planId = c.req.param('planId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const { stepId } = body as { stepId?: string }
  if (!stepId) return c.json({ error: 'stepId required' }, 400)

  const now = new Date().toISOString()

  const db = c.get('db_core')

  // Mark step done
  await db.execute(
    `UPDATE plan_steps SET status = 'done', completed_at = ? WHERE id = ? AND plan_id = ?`,
    [now, stepId, planId]
  )

  // Find the next locked step and unlock it
  const nextLocked = await db.queryOne<{ id: string; order_index: number }>(
    `SELECT id, order_index FROM plan_steps
     WHERE plan_id = ? AND status = 'locked'
     ORDER BY order_index ASC
     LIMIT 1`,
    [planId]
  )

  if (nextLocked) {
    await db.execute(
      `UPDATE plan_steps SET status = 'available' WHERE id = ?`,
      [nextLocked.id]
    )
  }

  // Update completed_steps count on plan
  const completedCount = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM plan_steps WHERE plan_id = ? AND status = 'done'`,
    [planId]
  )

  const newCount = completedCount?.count ?? 0

  await db.execute(
    `UPDATE business_plans SET completed_steps = ? WHERE id = ?`,
    [newCount, planId]
  )

  const plan = await db.queryOne<{ total_steps: number; completed_steps: number }>(
    `SELECT total_steps, completed_steps FROM business_plans WHERE id = ?`,
    [planId]
  )

  const progressPercent = plan && plan.total_steps > 0
    ? Math.round((plan.completed_steps / plan.total_steps) * 100)
    : 0

  return c.json({
    ok: true,
    completedSteps: newCount,
    totalSteps: plan?.total_steps ?? 0,
    progressPercent,
    nextUnlocked: nextLocked?.id ?? null,
  })
})
