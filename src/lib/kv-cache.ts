/**
 * Cloudflare KV edge cache helper.
 *
 * Pre-renders content to KV for fast edge reads.
 * Uses the Cloudflare REST API so it works from any environment
 * (build scripts, CI, local dev) — not just inside a Worker.
 */

interface KVCacheConfig {
  accountId: string
  kvNamespaceId: string
  apiToken: string
}

interface CachedContent {
  html: string
  metadata: Record<string, unknown>
}

function kvUrl(config: KVCacheConfig, key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.kvNamespaceId}/values/${encodeURIComponent(key)}`
}

function headers(config: KVCacheConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.apiToken}` }
}

/**
 * Cache pre-rendered HTML + metadata to KV under `page:<slug>`.
 * Metadata is stored as a separate key `meta:<slug>`.
 */
export async function cacheContent(
  config: KVCacheConfig,
  slug: string,
  html: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const pageRes = await fetch(kvUrl(config, `page:${slug}`), {
    method: 'PUT',
    headers: {
      ...headers(config),
      'Content-Type': 'text/html',
    },
    body: html,
  })

  if (!pageRes.ok) {
    const text = await pageRes.text()
    throw new Error(`KV PUT page:${slug} failed (${pageRes.status}): ${text}`)
  }

  const metaRes = await fetch(kvUrl(config, `meta:${slug}`), {
    method: 'PUT',
    headers: {
      ...headers(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (!metaRes.ok) {
    const text = await metaRes.text()
    throw new Error(`KV PUT meta:${slug} failed (${metaRes.status}): ${text}`)
  }
}

/**
 * Retrieve cached content from KV. Returns null if not found.
 */
export async function getCachedContent(
  config: KVCacheConfig,
  slug: string,
): Promise<CachedContent | null> {
  const [pageRes, metaRes] = await Promise.all([
    fetch(kvUrl(config, `page:${slug}`), { headers: headers(config) }),
    fetch(kvUrl(config, `meta:${slug}`), { headers: headers(config) }),
  ])

  if (pageRes.status === 404 || metaRes.status === 404) return null

  if (!pageRes.ok) {
    throw new Error(`KV GET page:${slug} failed (${pageRes.status})`)
  }
  if (!metaRes.ok) {
    throw new Error(`KV GET meta:${slug} failed (${metaRes.status})`)
  }

  const html = await pageRes.text()
  const metadata = (await metaRes.json()) as Record<string, unknown>

  return { html, metadata }
}

/**
 * Delete cached content from KV.
 */
export async function invalidateCache(
  config: KVCacheConfig,
  slug: string,
): Promise<void> {
  const [pageRes, metaRes] = await Promise.all([
    fetch(kvUrl(config, `page:${slug}`), {
      method: 'DELETE',
      headers: headers(config),
    }),
    fetch(kvUrl(config, `meta:${slug}`), {
      method: 'DELETE',
      headers: headers(config),
    }),
  ])

  // 404 is fine — key already gone
  if (!pageRes.ok && pageRes.status !== 404) {
    throw new Error(`KV DELETE page:${slug} failed (${pageRes.status})`)
  }
  if (!metaRes.ok && metaRes.status !== 404) {
    throw new Error(`KV DELETE meta:${slug} failed (${metaRes.status})`)
  }
}
