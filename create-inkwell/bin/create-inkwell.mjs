#!/usr/bin/env node

/**
 * create-inkwell — scaffold a new Inkwell project.
 *
 * Usage:
 *   npx create-inkwell my-site
 *   npx create-inkwell my-site --domain example.com
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createInterface } from 'node:readline'

const REPO = process.env.INKWELL_TEMPLATE_SOURCE || 'https://github.com/Mumega-com/inkwell.git'
const BRANCH = 'main'

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = {}
let projectName = null

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2)
    flags[key] = args[i + 1] ?? true
    if (args[i + 1] && !args[i + 1].startsWith('--')) i++
  } else if (!projectName) {
    projectName = args[i]
  }
}

// ── Prompt helper ───────────────────────────────────────────────────────────

function ask(question, fallback) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`${question} ${fallback ? `(${fallback})` : ''}: `, (answer) => {
      rl.close()
      resolve(answer.trim() || fallback || '')
    })
  })
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  create-inkwell — scaffold a forkable SaaS project\n')

  if (!projectName) {
    projectName = await ask('Project name', 'my-inkwell-site')
  }

  // Validate project name — alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    console.error('  Error: Project name must contain only letters, numbers, hyphens, and underscores.')
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), projectName)

  if (existsSync(targetDir)) {
    console.error(`  Error: ${targetDir} already exists.`)
    process.exit(1)
  }

  const siteName = flags.name || await ask('Site name', projectName)
  const domain = flags.domain || await ask('Domain', 'example.com')
  const primaryColor = flags.color || '#D4A017'

  console.log(`\n  Cloning Inkwell into ${projectName}...`)

  // Track whether the scaffold carries real git history (clone) vs. a local copy.
  let hasGitHistory = false

  try {
    if (existsSync(REPO)) {
      // Local path source — copy without .git (no upstream history to preserve).
      cpSync(REPO, targetDir, {
        recursive: true,
        filter: (source) => !/(^|\/)(\.git|node_modules|dist|\.astro)(\/|$)/.test(source),
      })
    } else {
      // Full clone (no --depth) so history is preserved and `git merge upstream/main`
      // works for ongoing updates. The fork STAYS updatable from upstream.
      execFileSync('git', ['clone', '--branch', BRANCH, REPO, targetDir], {
        stdio: 'pipe',
      })
      hasGitHistory = true
    }
  } catch {
    console.error('  Failed to clone repository. Check your network connection.')
    process.exit(1)
  }

  // Keep .git history and wire upstream sync. Rename origin -> upstream so
  // `git fetch upstream && git merge upstream/main` (or `npm run update`) works.
  // We deliberately do NOT set a new origin — the tenant adds their own repo later.
  if (hasGitHistory) {
    try {
      execFileSync('git', ['remote', 'rename', 'origin', 'upstream'], {
        cwd: targetDir,
        stdio: 'pipe',
      })
    } catch {
      // Non-fatal: scaffold still works, the tenant can add upstream manually.
      console.warn('  Warning: could not rename origin -> upstream. Add it manually:')
      console.warn(`    git remote add upstream ${REPO}`)
    }
  }

  // Capture the upstream commit SHA so `npm run update` can report drift.
  // For a clone, read HEAD; for a local-path copy, fall back to empty.
  let upstreamSha = ''
  if (hasGitHistory) {
    try {
      upstreamSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: targetDir,
        encoding: 'utf-8',
      }).trim()
    } catch {
      upstreamSha = ''
    }
  }
  writeFileSync(join(targetDir, '.inkwell-version'), `${upstreamSha}\n`)

  // Generate inkwell.config.ts from template
  const safeName = siteName.replace(/'/g, "\\'")
  const configContent = `export const config = {
  name: '${safeName}',
  domain: '${domain}',
  tagline: 'Powered by Inkwell',

  theme: {
    colors: {
      primary: '${primaryColor}',
      secondary: '#06B6D4',
      accent: '#10B981',
      danger: '#EF4444',
      bg:      { dark: '#0A0A10', light: '#FAFBFC' },
      surface: { dark: '#151519', light: '#FFFFFF' },
      text:    { dark: '#EDEDF0', light: '#1A1D23' },
      muted:   { dark: 'rgba(255,255,255,0.55)', light: 'rgba(0,0,0,0.55)' },
      dim:     { dark: 'rgba(255,255,255,0.35)', light: 'rgba(0,0,0,0.35)' },
      border:  { dark: 'rgba(255,255,255,0.10)', light: 'rgba(0,0,0,0.10)' },
    },
    fonts: {
      display: "'JetBrains Mono', monospace",
      body: "system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    radius: '6px',
    contentWidth: '680px',
    pageWidth: '1200px',
    darkFirst: true,
  },

  i18n: {
    defaultLang: 'en' as const,
    languages: ['en'] as const,
    rtl: ['fa', 'ar'] as const,
    fallback: 'en' as const,
  },

  features: {
    reactions: true,
    newsletter: true,
    readingProgress: true,
    toc: true,
    shareButtons: true,
    commandPalette: true,
    knowledgeGraph: true,
    rss: true,
    search: true,
    darkModeToggle: true,
  },

  analytics: {
    googleAnalytics: '',
    clarity: '',
    hotjar: '',
    tagManager: '',
    plausible: '',
  },

  seo: {
    organization: {
      name: '${safeName}',
      url: 'https://${domain}',
      logo: '/logo.svg',
      knowsAbout: [],
    },
    defaultAuthor: { name: 'Author', url: 'https://${domain}' },
  },

  workerUrl: '',
  dashboardUrl: 'https://dashboard.${domain}',
  allowedOrigins: [
    'https://${domain}',
    'https://*.${domain}',
  ],

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },

  adapters: {
    graph: 'd1',
    agent: 'd1',
    bus: 'standalone',
    memory: 'standalone',
    economy: 'standalone',
  },

  contentSources: [] as Array<
    | { type: 'github'; owner: string; repo: string; branch: string; path: string }
    | { type: 'notion'; databaseId: string }
    | { type: 'gdrive'; folderId: string }
    | { type: 'obsidian' }
  >,
} as const

export type InkwellConfig = typeof config
`

  writeFileSync(join(targetDir, 'inkwell.config.ts'), configContent)

  // Update wrangler.toml with the domain
  const wranglerPath = join(targetDir, 'workers', 'inkwell-api', 'wrangler.toml')
  if (existsSync(wranglerPath)) {
    let wrangler = readFileSync(wranglerPath, 'utf-8')
    wrangler = wrangler
      .replace(/example\.com/g, domain)
      .replace(/mumega\.com/g, domain)
      .replace(/name = "inkwell-api"/, `name = "${projectName}-api"`)
      .replace(/SITE_URL = ".*"/, `SITE_URL = "https://${domain}"`)
      .replace(/account_id = ".*"/, 'account_id = "YOUR_ACCOUNT_ID"')
      .replace(/database_id = ".*"/g, 'database_id = "YOUR_DATABASE_ID"')
      .replace(/^id = ".*"/gm, 'id = "YOUR_NAMESPACE_ID"')
    writeFileSync(wranglerPath, wrangler)
  }

  // Commit the scaffold customizations.
  //   - Clone path: history is preserved (upstream remote set), so commit the
  //     config/wrangler/.inkwell-version changes ON TOP of upstream history.
  //   - Local-path copy: no history exists, so init a fresh repo to track it.
  try {
    if (!hasGitHistory) {
      execFileSync('git', ['init'], { cwd: targetDir, stdio: 'pipe' })
    }
    execFileSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'pipe' })
    execFileSync('git', ['commit', '-m', 'Scaffold Inkwell fork'], {
      cwd: targetDir,
      stdio: 'pipe',
    })
  } catch {
    // Non-fatal: leave changes uncommitted; the tenant can commit themselves.
    console.warn('  Warning: could not create the initial scaffold commit.')
  }

  console.log(`
  Done! Your Inkwell project is ready.

  Next steps:

    cd ${projectName}
    npm install

  Connect your own repo (this scaffold keeps Inkwell as 'upstream'):

    git remote add origin git@github.com:YOUR_ORG/${projectName}.git
    git push -u origin main

  Stay in sync with upstream Inkwell at any time:

    npm run update      # fetch upstream, fast-forward merge, build proof

  To deploy the worker:

    cd workers/inkwell-api
    # Edit wrangler.toml with your Cloudflare account ID and resource IDs
    # Then create your D1 databases and KV namespaces:
    npx wrangler d1 create ${projectName}-core
    npx wrangler d1 create ${projectName}-analytics
    npx wrangler d1 create ${projectName}-marketing
    npx wrangler kv namespace create CONTENT
    npx wrangler kv namespace create SESSIONS
    npx wrangler r2 bucket create ${projectName}-media
    # Set your production token:
    npx wrangler secret put PUBLISH_TOKEN
    # Deploy:
    npm run deploy

  To connect your AI agent:

    # After deploying, visit https://${domain}/mcp/connect
    # Copy the config into your Claude Desktop, Cursor, or ChatGPT settings

  Docs: https://github.com/Mumega-com/inkwell
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
