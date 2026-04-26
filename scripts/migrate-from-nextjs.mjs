#!/usr/bin/env node
/**
 * migrate-from-nextjs.mjs
 *
 * Substrate-generic Next.js → Inkwell (Astro) markdown migration tool.
 *
 * Reads markdown files from a configurable Next.js content directory and
 * writes them into Inkwell's Astro content collections at
 * `content/<lang>/<collection>/`. Along the way:
 *
 *   - Converts fenced ```` ``` ```` equation blocks into `$$..$$` display math
 *     (legacy Next.js sites often rendered equations as un-styled code blocks)
 *   - Un-escapes double backslashes inside math (`\\Lambda` → `\Lambda`)
 *     so KaTeX can parse them
 *   - Optional best-effort transliteration of plain-text pseudo-LaTeX
 *     (`Lambda`, `hbar`, `psi`, `omega`, `frac`, ...) to real LaTeX commands
 *     — opt in with `--transliterate-math`. Useful for legacy academic sites.
 *   - Frontmatter passthrough with a configurable field-rename map
 *     (`--rename-field=oldKey:newKey`, repeatable)
 *   - De-duplicates frontmatter keys (some legacy exporters emit the same
 *     key twice; Astro's Zod validator chokes on those)
 *
 * Authored as part of FRC's onboarding to Inkwell (Sprint 010, 2026-04-26)
 * and refined into substrate-generic form. Math transliteration originated
 * in the FRC migration but is now opt-in so it doesn't surprise non-academic
 * forks.
 *
 * Usage:
 *
 *   node scripts/migrate-from-nextjs.mjs \
 *     --source <path-to-nextjs-content-dir> \
 *     --target <path-to-astro-content-dir> \
 *     --collection <name> \
 *     [--lang en] \
 *     [--transliterate-math] \
 *     [--rename-field=publishedAt:date] \
 *     [--rename-field=cover:coverImage] \
 *     [--skip-existing] \
 *     [--only=<file-prefix>]
 *
 * Examples:
 *
 *   # Plain blog migration: Next.js posts → Inkwell `articles/` collection
 *   node scripts/migrate-from-nextjs.mjs \
 *     --source ../old-nextjs-site/content/posts \
 *     --target ./content/en/articles \
 *     --collection articles \
 *     --rename-field=publishedAt:date
 *
 *   # Academic / research site with KaTeX math
 *   node scripts/migrate-from-nextjs.mjs \
 *     --source ../old-nextjs-site/content/papers \
 *     --target ./content/en/papers \
 *     --collection papers \
 *     --transliterate-math
 *
 * Idempotent: rewrites destination files unless --skip-existing is passed.
 * Output: prints a JSON summary (migrated count, skipped count, per-file stats).
 */

import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { resolve, join } from 'node:path'

// ---------- arg parsing ---------------------------------------------------

const args = process.argv.slice(2)
const flags = {}
const renameField = []

for (const a of args) {
  if (!a.startsWith('--')) continue
  const [k, v] = a.replace(/^--/, '').split('=')
  if (k === 'rename-field' && v) {
    const [from, to] = v.split(':')
    if (from && to) renameField.push([from, to])
  } else {
    flags[k] = v ?? true
  }
}

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`)
  console.error(
    [
      'usage: migrate-from-nextjs.mjs --source <path> --target <path> --collection <name>',
      '                               [--lang en] [--transliterate-math]',
      '                               [--rename-field=oldKey:newKey ...]',
      '                               [--skip-existing] [--only=<prefix>]',
      '',
      'Migrates plain-markdown content from a Next.js content directory into',
      "Inkwell's Astro content collections.",
    ].join('\n')
  )
  process.exit(2)
}

if (!flags.source) usage('--source is required')
if (!flags.target) usage('--target is required')
if (!flags.collection) usage('--collection is required')

const SRC = resolve(flags.source)
const DEST = resolve(flags.target)
const collection = flags.collection
const lang = flags.lang || 'en'
const transliterateMathFlag = !!flags['transliterate-math']
const skipExisting = !!flags['skip-existing']
const onlyPrefix = flags.only

if (!existsSync(SRC)) {
  console.error(`source dir not found: ${SRC}`)
  process.exit(1)
}
if (!existsSync(DEST)) mkdirSync(DEST, { recursive: true })

// ---------- math transliteration table (opt-in) ---------------------------
//
// Plain-text equation pseudo-syntax → LaTeX. Word-boundary matched so
// English prose isn't garbled. Only applied when --transliterate-math is set.

const greekLower = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
  'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
]
const greekUpper = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
]
const operators = [
  ['hbar', '\\hbar'], ['partial', '\\partial'], ['nabla', '\\nabla'],
  ['infty', '\\infty'], ['cdot', '\\cdot'], ['times', '\\times'],
  ['langle', '\\langle'], ['rangle', '\\rangle'],
  ['mathbb', '\\mathbb'], ['mathcal', '\\mathcal'],
  ['rightarrow', '\\rightarrow'], ['leftarrow', '\\leftarrow'],
  ['leq', '\\leq'], ['geq', '\\geq'], ['neq', '\\neq'],
  ['approx', '\\approx'], ['sim', '\\sim'], ['propto', '\\propto'],
  ['sum', '\\sum'], ['int', '\\int'], ['prod', '\\prod'],
  ['exp', '\\exp'], ['log', '\\log'], ['ln', '\\ln'],
  ['sin', '\\sin'], ['cos', '\\cos'], ['tan', '\\tan'], ['lim', '\\lim'],
  ['frac', '\\frac'], ['sqrt', '\\sqrt'],
  ['div', '\\nabla\\cdot'], ['grad', '\\nabla'], ['curl', '\\nabla\\times'],
]

function wordRegexFromList(words) {
  const escaped = words
    .map((w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|')
  return new RegExp(`(?<![\\\\A-Za-z])(${escaped})(?![A-Za-z])`, 'g')
}

const greekLowerRe = wordRegexFromList(greekLower)
const greekUpperRe = wordRegexFromList(greekUpper)
const operatorMap = new Map(operators)
const operatorRe = wordRegexFromList(operators.map(([w]) => w))

function transliterateMath(eq) {
  let out = eq
  out = out.replace(operatorRe, (_m, w) => operatorMap.get(w) ?? w)
  out = out.replace(greekLowerRe, (_m, w) => `\\${w}`)
  out = out.replace(greekUpperRe, (_m, w) => `\\${w}`)
  return out
}

// ---------- math un-escape (always on) ------------------------------------

// Un-escape doubled backslashes inside math delimiters. Some legacy exporters
// JSON-encode markdown and end up writing `\\Lambda` where `\Lambda` was
// meant. Apply this within `$$..$$` (display) and `$..$` (inline) only,
// never to surrounding prose.
function unescapeMathBackslashes(body) {
  // Display math
  body = body.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => {
    return `$$${inner.replace(/\\\\/g, '\\')}$$`
  })
  // Inline math — single $..$, but be careful not to match `$5.00` or empty $$.
  body = body.replace(/(?<!\$)\$([^\n$][^\n$]*?)\$(?!\$)/g, (_m, inner) => {
    return `$${inner.replace(/\\\\/g, '\\')}$`
  })
  return body
}

// ---------- frontmatter helpers -------------------------------------------

function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { frontmatter: '', body: raw }
  return { frontmatter: m[1], body: m[2] }
}

function dedupeFrontmatter(fm) {
  const seen = new Set()
  const lines = fm.split('\n')
  const out = []
  for (const line of lines) {
    const isTopLevel = /^[a-zA-Z_][\w-]*:/.test(line) && !line.startsWith(' ')
    if (isTopLevel) {
      const key = line.split(':')[0]
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(line)
  }
  return out.join('\n')
}

function renameFrontmatterFields(fm, renames) {
  if (!renames.length) return fm
  return fm
    .split('\n')
    .map((line) => {
      const m = line.match(/^([a-zA-Z_][\w-]*):(.*)$/)
      if (!m) return line
      const [, key, rest] = m
      const rule = renames.find(([from]) => from === key)
      return rule ? `${rule[1]}:${rest}` : line
    })
    .join('\n')
}

// ---------- body conversion -----------------------------------------------

function convertFencedMath(body, { transliterate }) {
  // Only convert un-tagged fences (``` with nothing after) — we don't want to
  // turn ```js or ```bash blocks into math. Heuristic: opening fence has no
  // language identifier.
  return body.replace(/^```\s*\n([\s\S]*?)^```\s*$/gm, (_m, eq) => {
    const eqTrimmed = eq.trim()
    const out = transliterate ? transliterateMath(eqTrimmed) : eqTrimmed
    return `$$\n${out}\n$$`
  })
}

// ---------- main ----------------------------------------------------------

const files = readdirSync(SRC).filter(
  (f) => f.endsWith('.md') && (!onlyPrefix || f.startsWith(onlyPrefix))
)

let migrated = 0
let skipped = 0
const summary = []

for (const f of files) {
  const srcPath = join(SRC, f)
  const destPath = join(DEST, f)

  if (skipExisting && existsSync(destPath)) {
    skipped++
    summary.push({ file: f, status: 'skipped (exists)' })
    continue
  }

  const raw = readFileSync(srcPath, 'utf8')
  const { frontmatter, body } = splitFrontmatter(raw)
  let fmClean = dedupeFrontmatter(frontmatter)
  fmClean = renameFrontmatterFields(fmClean, renameField)

  let bodyConverted = convertFencedMath(body, {
    transliterate: transliterateMathFlag,
  })
  bodyConverted = unescapeMathBackslashes(bodyConverted)

  const out = `---\n${fmClean}\n---\n${bodyConverted}`
  writeFileSync(destPath, out, 'utf8')
  migrated++

  const fences = (body.match(/^```/gm) || []).length / 2
  const wikilinks = (body.match(/\[\[[^\]]+\]\]/g) || []).length
  summary.push({
    file: f,
    status: 'migrated',
    fences_converted: Math.floor(fences),
    wikilinks,
    src_bytes: raw.length,
  })
}

console.log(
  JSON.stringify(
    {
      collection,
      lang,
      transliterate_math: transliterateMathFlag,
      renamed_fields: renameField.map(([from, to]) => `${from}→${to}`),
      migrated,
      skipped,
      summary,
    },
    null,
    2
  )
)
