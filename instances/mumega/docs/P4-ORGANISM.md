# P4 — The Organism Layer

The system that improves itself. Each feature builds on traffic data from P1-P3.

**Prerequisite:** your-domain.com live with Clarity + GA collecting data (done).
**When to start:** After 2+ weeks of traffic data and 20+ published posts.

---

## 1. Content as Context

**What:** Vectorize all published posts so agents writing new content can reference existing work. The body of published content becomes the context for new content.

**Why:** An agent writing about "MIND tokens" should know we already have 3 posts covering the economy. It should reference them, not repeat them. And its opinions should be consistent with what we've already published.

**How:**
```
1. Use Cloudflare Vectorize (or local embeddings via Workers AI)
2. On each build, embed all posts:
   - Split each post into chunks (~500 tokens)
   - Generate embeddings via Workers AI (bge-base-en)
   - Store in Vectorize index: inkwell-content-vectors
3. Before writing new content, agent queries:
   "What have we already written about {topic}?"
   → Returns top 5 relevant chunks with post slugs
4. Agent uses these as context — references existing posts, avoids contradictions
```

**Files to create:**
- `scripts/vectorize.ts` — embed all posts, store in Vectorize
- `workers/inkwell-api/` — add `GET /api/context?q={query}` endpoint
- Run after each deploy: `npm run vectorize`

**Config:**
```typescript
organism: {
  memory: {
    embedContent: true,
    vectorizeIndex: 'inkwell-content-vectors',
    model: 'bge-base-en-v1.5',
  },
}
```

**Cloudflare resources needed:**
- Vectorize index: `inkwell-content-vectors`
- Workers AI binding for embedding model

---

## 2. Adaptive Pages

**What:** Weekly Worker cron reads Clarity/GA data, Gemma analyzes it, suggests page improvements.

**Why:** A post with 80% drop-off at section 3 needs section 3 rewritten. A CTA with 0 clicks needs moving. The site should learn from its readers.

**How:**
```
Weekly cron (Cloudflare Worker scheduled trigger):
  1. Fetch Clarity API → heatmaps, scroll depth, dead clicks per page
  2. Fetch GA4 API → page views, bounce rate, avg time, exit pages
  3. Fetch Search Console API → queries, impressions, clicks, position
  4. For each page with issues:
     - "Section 3 has 80% drop-off" → task: rewrite section 3, max 200 words
     - "CTA has 0 clicks" → task: move CTA above fold
     - "Mobile bounce 85%" → task: simplify layout
     - "Ranking #8 for 'ai agent cms'" → task: add more content about this keyword
  5. Create SOS tasks OR content/inbox/ drafts with improvements
  6. Track: did the change improve metrics next week?
```

**Files to create:**
- `workers/inkwell-cron/` — scheduled Worker
- `workers/inkwell-cron/src/analyze.ts` — reads analytics APIs
- `workers/inkwell-cron/src/suggest.ts` — Gemma generates suggestions
- `workers/inkwell-cron/wrangler.toml` — with cron trigger: `0 6 * * MON`

**API keys needed:**
- Clarity API access (from MS account)
- GA4 API (service account or OAuth)
- Search Console API (same Google auth)
- Workers AI binding (for Gemma model)

**Config:**
```typescript
organism: {
  reinforce: {
    schedule: 'weekly',
    model: '@cf/google/gemma-7b-it',
    apis: {
      clarity: process.env.CLARITY_API_KEY,
      ga4: process.env.GA4_CREDENTIALS,
      searchConsole: process.env.GSC_CREDENTIALS,
    },
    thresholds: {
      dropOffPercent: 60,       // flag sections with >60% exit
      bounceRatePercent: 70,    // flag pages with >70% bounce
      ctaClickPercent: 1,       // flag CTAs with <1% click rate
    },
  },
}
```

---

## 3. A/B Testing

**What:** Serve different versions of content to different visitors. Track which version performs better.

**Why:** "Move CTA above fold" is a hypothesis. A/B testing proves it.

**How:**
```
1. Store variants in KV:
   Key: variant:{slug}:{variant-id}
   Value: { changes: { "section-3": "rewritten content...", "cta-position": "above-fold" } }

2. Worker middleware reads visitor cookie → assigns variant (A or B)
3. Astro page checks KV for active variant → applies changes
4. Analytics tracks: which variant gets better scroll depth, clicks, conversions
5. After 1 week: winner becomes default, loser is archived
```

**Files to create:**
- `src/lib/ab-test.ts` — variant assignment, cookie management
- `workers/inkwell-api/` — add `POST /api/variant` (create), `GET /api/variant/:slug` (read)
- KV structure: `variant:{slug}:{id}` → changes JSON

**Depends on:** Adaptive Pages (generates the hypotheses to test)

---

## 4. Schema Predator

**What:** Read competitor SERPs for target keywords. Generate richer structured data than them. Deploy faster.

**Why:** 71% of ChatGPT-cited pages have structured data. Richer schema = higher visibility in both search engines and LLMs.

**How:**
```
Weekly:
  1. For each target keyword in config:
     - Fetch top 10 SERP results (via SerpAPI or scraping)
     - Extract their JSON-LD schema
     - Compare to our page's schema
  2. If competitor has BlogPosting only:
     → We add BlogPosting + FAQPage + HowTo + VideoObject
  3. If competitor has no video:
     → We generate a video (Remotion) and add VideoObject
  4. If competitor has no FAQ:
     → Agent generates FAQ section, adds FAQPage schema
  5. Deploy updated page with richer schema
```

**Files to create:**
- `scripts/schema-audit.ts` — fetch SERPs, extract competitor schema
- `scripts/schema-enhance.ts` — generate richer schema for our pages

**Config:**
```typescript
organism: {
  schema: {
    competitive: true,
    targetKeywords: [
      'ai agent cms',
      'ai workforce network',
      'mind token economy',
      'agent publishing platform',
    ],
    serpApi: process.env.SERP_API_KEY,  // or use free alternatives
  },
}
```

**Depends on:** Target keywords defined, content ranking for those keywords

---

## 5. Video Generation

**What:** Remotion renders blog posts as animated videos. Same content, video format.

**Why:** VideoObject schema captures video carousel in search. YouTube distribution. 2x engagement.

**How:**
```
For each post:
  1. Read post markdown
  2. Extract: title, key stats, charts, pull quotes, CTA
  3. Generate Remotion composition:
     Scene 1: Title card (gold on black, animated)
     Scene 2: TL;DR (fade in, 5 seconds)
     Scene 3: ::chart blocks → animated charts (bars growing, etc.)
     Scene 4: Key quote → styled, TTS narration
     Scene 5: ::stats → numbers counting up
     Scene 6: CTA → "Read full post at your-domain.com/blog/..."
  4. Render MP4 (1080p, 60-90 seconds)
  5. Upload to R2 + optionally YouTube
  6. Update post frontmatter with cover_video
  7. VideoObject schema auto-generated
```

**Files to create:**
- `scripts/generate-video.ts` — orchestrates the pipeline
- `video/` — Remotion project with compositions
- `video/compositions/BlogPost.tsx` — main video template
- `video/compositions/ChartScene.tsx` — animated chart
- `video/compositions/StatsScene.tsx` — counting numbers

**Dependencies:**
- `npm install @remotion/cli @remotion/renderer` (heavy — keep separate)
- TTS: Workers AI or ElevenLabs
- R2 for storage, YouTube API for upload (optional)

**Config:**
```typescript
organism: {
  video: {
    engine: 'remotion',
    tts: '@cf/meta/llama-3-tts',  // or 'elevenlabs'
    autoGenerate: false,           // manual until tested
    uploadTo: ['r2'],              // add 'youtube' later
    style: {
      bg: '#0A0A10',
      accent: '#D4A017',
      font: 'JetBrains Mono',
      duration: '60-90s',
    },
  },
}
```

---

## 6. Programmatic Generation

**What:** Template × Variable matrix for scale SEO. Like inkwell-cms but on Inkwell.

**Why:** DentalNearYou needs 15 cities × 15 services × 6 languages = 1,350 pages. Can't write each manually.

**How:**
```
1. Define template: "Best {service} in {city}"
2. Define variables:
   services: [implants, root-canal, whitening, ...]
   cities: [toronto, vancouver, montreal, ...]
   languages: [en, fr]
3. For each combination:
   - Generate content via AI (Gemma for volume, Claude for quality)
   - Apply quality gate (SEO score, uniqueness, fact check)
   - Store in KV (edge delivery)
   - Generate per-page JSON-LD
4. Serve via Worker (dynamic routing)
```

**Files to create:**
- `scripts/generate-programmatic.ts` — matrix generator
- `templates/programmatic/` — content templates per type
- Worker route: `/{lang}/{template}/{vars}` → KV lookup → render

**Config:**
```typescript
organism: {
  programmatic: {
    enabled: false,  // per-project opt-in
    templates: [],
    variables: {},
    model: '@cf/google/gemma-7b-it',
    qualityGate: true,
    batchSize: 10,   // pages per day
  },
}
```

**Depends on:** Client project with defined keyword matrix

---

## 7. Content Pruning

**What:** Monthly review. Archive posts that didn't find an audience. Keep the site dense with quality.

**Why:** 100 mediocre posts dilute authority. 30 strong posts build it. The organism should shed what doesn't work.

**How:**
```
Monthly cron:
  1. Query D1: posts with < {threshold} views after 30 days
  2. Query GA: posts with > 80% bounce rate
  3. Check backlinks: posts with zero incoming links
  4. For each underperformer:
     - If fixable (bad title, no description) → create improvement task
     - If unfixable (wrong topic, no audience) → archive
  5. Archived posts: move to content/en/archive/, remove from sitemap
  6. Knowledge graph: node dims but doesn't disappear (history preserved)
```

**Files to create:**
- Add to `workers/inkwell-cron/src/prune.ts`
- `scripts/archive.ts` — move posts to archive, update sitemap

**Config:**
```typescript
organism: {
  prune: {
    schedule: 'monthly',
    thresholds: {
      minViews30d: 10,      // less than 10 views in 30 days
      maxBounceRate: 85,     // higher than 85%
      minAge: 30,            // don't prune posts younger than 30 days
    },
    action: 'archive',       // or 'flag-for-review'
  },
}
```

**Depends on:** 30+ days of analytics data

---

## 8. Referral Program

**What:** Subscribers recruit subscribers. Milestone rewards.

**Why:** Beehiiv proved this works — referral-driven growth is 3x cheaper than paid acquisition.

**How:**
```
1. Each subscriber gets a referral link: your-domain.com?ref={code}
2. When someone subscribes via referral link:
   - Referrer gets credit in D1
   - Subscriber tagged with referrer
3. Milestones:
   - 3 referrals → featured in newsletter
   - 10 referrals → early access to new content
   - 25 referrals → direct access to agent squad
4. Track in D1: referrals table (referrer_email, referred_email, date)
```

**Files to create:**
- `workers/inkwell-api/` — add referral tracking endpoints
- D1 migration: `CREATE TABLE referrals (...)`
- Newsletter template: include referral link
- Landing page: `/refer` with progress tracker

**Config:**
```typescript
organism: {
  referral: {
    enabled: false,
    milestones: [
      { count: 3, reward: 'newsletter-feature' },
      { count: 10, reward: 'early-access' },
      { count: 25, reward: 'squad-access' },
    ],
  },
}
```

**Depends on:** Active newsletter with subscribers

---

## Implementation Order

```
Week 3-4:  Content as Context (vectorize posts, agent context API)
Week 5-6:  Schema Predator (audit competitors, enhance our schema)
Week 7-8:  Adaptive Pages (read analytics, suggest improvements)
Week 9-10: A/B Testing (test the suggestions)
Week 11+:  Video Generation (Remotion pipeline)
Week 12+:  Content Pruning (first monthly review)
Later:     Programmatic Generation (when client project needs it)
Later:     Referral Program (when newsletter has subscribers)
```

---

*This doc is the spec for P4. Each section is self-contained and can be built independently. Start with Content as Context — it makes every other feature better.*
