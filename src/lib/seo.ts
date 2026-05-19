/**
 * Inkwell v2 — JSON-LD Structured Data Generator
 *
 * Auto-generates Schema.org JSON-LD for AI search visibility.
 * Uses @graph pattern: all schemas in a single script tag.
 *
 * Supported types (14):
 *   BlogPosting, Article, ScholarlyArticle, VideoObject, FAQPage,
 *   HowTo, Person, Organization, WebSite, WebPage, BreadcrumbList,
 *   ItemList, Product, Course
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ContentMeta {
  slug: string
  title: string
  type: string
  description?: string
  author?: string
  date?: string
  updated?: string
  cover_image?: string
  cover_video?: string
  tags?: string[]
  duration?: string
  word_count?: number
  faq_items?: Array<{ question: string; answer: string }>
  howto_steps?: Array<{ name: string; text: string; image?: string }>
  series?: string
  lang?: string
  price?: string
  currency?: string
  availability?: string
  provider?: string
  job_title?: string
  social_links?: Record<string, string>
  items?: Array<{ name: string; url: string; position?: number }>
}

export interface SiteConfig {
  name: string
  url: string
  logo?: string
  description?: string
  social?: Record<string, string>
  knowsAbout?: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function contentUrl(slug: string, site: SiteConfig): string {
  const base = stripTrailingSlash(site.url)
  const clean = slug.startsWith('/') ? slug : `/${slug}`
  return `${base}${clean}`
}

function slugToLabel(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function socialToSameAs(social?: Record<string, string>): string[] {
  if (!social) return []
  return Object.values(social).filter(Boolean)
}

// ─── Schema Builders ───────────────────────────────────────────────────────

function buildWebPage(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'WebPage',
    '@id': url,
    url,
    name: content.title,
    description: content.description,
    inLanguage: content.lang ?? 'en',
    isPartOf: { '@id': `${stripTrailingSlash(site.url)}/#website` },
    ...(content.date ? { datePublished: content.date } : {}),
    ...(content.updated ? { dateModified: content.updated } : {}),
  }
}

function buildBlogPosting(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    headline: content.title,
    description: content.description,
    ...(content.date ? { datePublished: content.date } : {}),
    ...(content.updated ? { dateModified: content.updated } : {}),
    author: content.author
      ? { '@type': 'Person', name: content.author }
      : { '@type': 'Organization', '@id': `${stripTrailingSlash(site.url)}/#org` },
    publisher: { '@id': `${stripTrailingSlash(site.url)}/#org` },
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.word_count ? { wordCount: content.word_count } : {}),
    ...(content.tags?.length ? { keywords: content.tags.join(', ') } : {}),
    ...(content.series
      ? { isPartOf: { '@type': 'CreativeWorkSeries', name: content.series } }
      : {}),
    inLanguage: content.lang ?? 'en',
    mainEntityOfPage: { '@id': url },
  }
}

function buildArticle(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    url,
    headline: content.title,
    description: content.description,
    ...(content.date ? { datePublished: content.date } : {}),
    ...(content.updated ? { dateModified: content.updated } : {}),
    author: content.author
      ? { '@type': 'Person', name: content.author }
      : { '@type': 'Organization', '@id': `${stripTrailingSlash(site.url)}/#org` },
    publisher: { '@id': `${stripTrailingSlash(site.url)}/#org` },
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.word_count ? { wordCount: content.word_count } : {}),
    ...(content.tags?.length ? { keywords: content.tags.join(', ') } : {}),
    inLanguage: content.lang ?? 'en',
    mainEntityOfPage: { '@id': url },
  }
}

function buildScholarlyArticle(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'ScholarlyArticle',
    '@id': `${url}#article`,
    url,
    headline: content.title,
    description: content.description,
    ...(content.date ? { datePublished: content.date } : {}),
    ...(content.updated ? { dateModified: content.updated } : {}),
    author: content.author
      ? { '@type': 'Person', name: content.author }
      : { '@type': 'Organization', '@id': `${stripTrailingSlash(site.url)}/#org` },
    publisher: { '@id': `${stripTrailingSlash(site.url)}/#org` },
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.tags?.length ? { keywords: content.tags.join(', ') } : {}),
    inLanguage: content.lang ?? 'en',
    mainEntityOfPage: { '@id': url },
  }
}

function buildVideoObject(content: ContentMeta, site: SiteConfig): object | null {
  if (!content.cover_video) return null
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'VideoObject',
    '@id': `${url}#video`,
    name: content.title,
    description: content.description,
    ...(content.cover_image ? { thumbnailUrl: content.cover_image } : {}),
    ...(content.date ? { uploadDate: content.date } : {}),
    ...(content.duration ? { duration: content.duration } : {}),
    contentUrl: content.cover_video,
    ...(content.cover_video.includes('youtube') || content.cover_video.includes('vimeo')
      ? { embedUrl: content.cover_video }
      : {}),
    inLanguage: content.lang ?? 'en',
  }
}

function buildFAQPage(content: ContentMeta): object | null {
  if (!content.faq_items?.length) return null
  return {
    '@type': 'FAQPage',
    mainEntity: content.faq_items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

function buildHowTo(content: ContentMeta, site: SiteConfig): object | null {
  if (!content.howto_steps?.length) return null
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: content.title,
    description: content.description,
    ...(content.cover_image ? { image: content.cover_image } : {}),
    step: content.howto_steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
    })),
  }
}

function buildPerson(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: content.title,
    url,
    ...(content.job_title ? { jobTitle: content.job_title } : {}),
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.description ? { description: content.description } : {}),
    ...(content.social_links
      ? { sameAs: socialToSameAs(content.social_links) }
      : {}),
  }
}

function buildProduct(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: content.title,
    url,
    description: content.description,
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.price
      ? {
          offers: {
            '@type': 'Offer',
            price: content.price,
            priceCurrency: content.currency ?? 'USD',
            availability: content.availability
              ? `https://schema.org/${content.availability}`
              : 'https://schema.org/InStock',
            url,
          },
        }
      : {}),
  }
}

function buildCourse(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'Course',
    '@id': `${url}#course`,
    name: content.title,
    url,
    description: content.description,
    ...(content.provider
      ? { provider: { '@type': 'Organization', name: content.provider } }
      : { provider: { '@id': `${stripTrailingSlash(site.url)}/#org` } }),
    ...(content.cover_image ? { image: content.cover_image } : {}),
    ...(content.tags?.length ? { keywords: content.tags.join(', ') } : {}),
    inLanguage: content.lang ?? 'en',
  }
}

function buildCollectionPage(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  return {
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: content.title,
    description: content.description,
    inLanguage: content.lang ?? 'en',
    isPartOf: { '@id': `${stripTrailingSlash(site.url)}/#website` },
  }
}

function buildItemList(content: ContentMeta, site: SiteConfig): object {
  const url = contentUrl(content.slug, site)
  const items = content.items ?? []
  return {
    '@type': 'ItemList',
    '@id': `${url}#list`,
    name: content.title,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: item.position ?? i + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : contentUrl(item.url, site),
    })),
  }
}

// ─── Type Router ───────────────────────────────────────────────────────────

const TYPE_BUILDERS: Record<
  string,
  (content: ContentMeta, site: SiteConfig) => object | null
> = {
  blog: buildBlogPosting,
  post: buildBlogPosting,
  article: buildArticle,
  scholarly: buildScholarlyArticle,
  video: buildVideoObject,
  person: buildPerson,
  product: buildProduct,
  course: buildCourse,
  list: buildItemList,
  collection: buildCollectionPage,
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate all JSON-LD objects for a content page.
 * Returns an array of schema objects meant to be wrapped in a single
 * `<script type="application/ld+json">` tag using @graph.
 */
export function generateJsonLd(
  content: ContentMeta,
  site: SiteConfig
): object[] {
  const graph: object[] = []

  // Every page gets WebPage
  graph.push(buildWebPage(content, site))

  // Breadcrumbs for every page
  graph.push(generateBreadcrumbs(content.slug, site))

  // Type-specific schema
  const builder = TYPE_BUILDERS[content.type]
  if (builder) {
    const schema = builder(content, site)
    if (schema) graph.push(schema)
  }

  // Auto-detect: FAQPage from faq_items
  const faq = buildFAQPage(content)
  if (faq) graph.push(faq)

  // Auto-detect: HowTo from howto_steps
  const howto = buildHowTo(content, site)
  if (howto) graph.push(howto)

  // Auto-detect: VideoObject when cover_video present (even on non-video types)
  if (content.type !== 'video' && content.cover_video) {
    const video = buildVideoObject(content, site)
    if (video) graph.push(video)
  }

  return graph
}

/**
 * Generate BreadcrumbList from a URL slug.
 * `/blog/my-post` -> Home > Blog > My Post
 */
export function generateBreadcrumbs(
  slug: string,
  site: SiteConfig
): object {
  const base = stripTrailingSlash(site.url)
  const segments = slug.replace(/^\/|\/$/g, '').split('/').filter(Boolean)

  const items: Array<{ name: string; url: string }> = [
    { name: 'Home', url: base },
  ]

  let path = ''
  for (const segment of segments) {
    path += `/${segment}`
    items.push({
      name: slugToLabel(segment),
      url: `${base}${path}`,
    })
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Generate site-level schemas: Organization, WebSite, SearchAction.
 * Rendered once in the root layout.
 */
export function generateSiteMeta(site: SiteConfig): object[] {
  const base = stripTrailingSlash(site.url)

  const website: object = {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: site.name,
    url: base,
    ...(site.description ? { description: site.description } : {}),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const organization: object = {
    '@type': 'Organization',
    '@id': `${base}/#org`,
    name: site.name,
    url: base,
    ...(site.logo ? { logo: site.logo } : {}),
    ...(site.description ? { description: site.description } : {}),
    sameAs: socialToSameAs(site.social),
    // knowsAbout is the highest-leverage SEO property for AI search in 2026.
    // Pages cited by ChatGPT/Gemini disproportionately include this field.
    ...(site.knowsAbout?.length ? { knowsAbout: site.knowsAbout } : {}),
  }

  return [website, organization]
}

/**
 * Generate OpenGraph + Twitter meta tags as a flat key-value map.
 * Caller renders as `<meta property={key} content={value} />`.
 */
export function generateOgMeta(
  content: ContentMeta,
  site: SiteConfig
): Record<string, string> {
  const url = contentUrl(content.slug, site)
  const isVideo = content.type === 'video' || !!content.cover_video

  const meta: Record<string, string> = {
    'og:title': content.title,
    'og:url': url,
    'og:site_name': site.name,
    'og:locale': content.lang ?? 'en',
  }

  if (content.description) {
    meta['og:description'] = content.description
    meta['twitter:description'] = content.description
  }

  if (content.cover_image) {
    meta['og:image'] = content.cover_image
    meta['twitter:image'] = content.cover_image
  }

  // Video-specific OG
  if (isVideo && content.cover_video) {
    meta['og:type'] = 'video.other'
    meta['og:video'] = content.cover_video
    meta['og:video:type'] = 'text/html'
    meta['twitter:card'] = 'player'
    meta['twitter:player'] = content.cover_video
  } else if (content.type === 'blog' || content.type === 'article' || content.type === 'scholarly') {
    meta['og:type'] = 'article'
    if (content.date) meta['article:published_time'] = content.date
    if (content.updated) meta['article:modified_time'] = content.updated
    if (content.author) meta['article:author'] = content.author
    if (content.tags?.length) meta['article:tag'] = content.tags[0]
    meta['twitter:card'] = 'summary_large_image'
  } else if (content.type === 'product') {
    meta['og:type'] = 'product'
    if (content.price) meta['product:price:amount'] = content.price
    if (content.currency) meta['product:price:currency'] = content.currency
    meta['twitter:card'] = 'summary_large_image'
  } else {
    meta['og:type'] = 'website'
    meta['twitter:card'] = content.cover_image ? 'summary_large_image' : 'summary'
  }

  meta['twitter:title'] = content.title

  return meta
}

/**
 * Wrap schema objects into a single @graph JSON-LD block.
 * Use with: `<script type="application/ld+json">{toJsonLdString(schemas)}</script>`
 */
export function toJsonLdString(schemas: object[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': schemas,
  })
}
