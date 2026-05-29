#!/usr/bin/env node

/**
 * inkwell-update — keep a forked Inkwell project in sync with upstream.
 *
 * What it does:
 *   1. git fetch upstream
 *   2. report how many commits behind upstream/main you are
 *   3. git merge --ff-only upstream/main  (clean, no merge commit)
 *      — if a fast-forward is impossible (you have local commits that
 *        diverged), fall back to a normal merge and tell you to resolve.
 *   4. run the build proof: scripts/fork-smoke.sh if present, else `npm run build`
 *   5. print "now current"
 *
 * Usage: npm run update   (or: node scripts/inkwell-update.mjs)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UPSTREAM = 'upstream'
const BRANCH = 'main'

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf-8',
    ...opts,
  })
}

function fail(msg) {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

// ── Preconditions ────────────────────────────────────────────────────────────

// Must be a git repo.
try {
  git(['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' })
} catch {
  fail('Not a git repository. Run this from your Inkwell project root.')
}

// Must have the upstream remote (set by create-inkwell as origin -> upstream).
let remotes = ''
try {
  remotes = git(['remote'], { stdio: 'pipe' })
} catch {
  remotes = ''
}
if (!remotes.split(/\s+/).includes(UPSTREAM)) {
  fail(
    `No '${UPSTREAM}' remote found. Add it with:\n` +
      `    git remote add ${UPSTREAM} https://github.com/Mumega-com/inkwell.git`,
  )
}

// Working tree must be clean before we merge.
let dirty = ''
try {
  dirty = git(['status', '--porcelain'], { stdio: 'pipe' }).trim()
} catch {
  dirty = ''
}
if (dirty) {
  fail('Working tree has uncommitted changes. Commit or stash them, then re-run.')
}

// ── 1. Fetch upstream ────────────────────────────────────────────────────────

console.log(`\n  Fetching ${UPSTREAM}...`)
try {
  git(['fetch', UPSTREAM], { stdio: 'inherit' })
} catch {
  fail(`Failed to fetch ${UPSTREAM}. Check your network connection.`)
}

// ── 2. Report drift ──────────────────────────────────────────────────────────

let behind = '0'
try {
  behind = git(['rev-list', '--count', `HEAD..${UPSTREAM}/${BRANCH}`], {
    stdio: 'pipe',
  }).trim()
} catch {
  fail(`Could not compare against ${UPSTREAM}/${BRANCH}. Does that branch exist?`)
}

if (behind === '0') {
  console.log('\n  Already up to date with upstream. Nothing to merge.')
  recordVersion()
  console.log('\n  now current\n')
  process.exit(0)
}

console.log(`\n  You are ${behind} commit(s) behind ${UPSTREAM}/${BRANCH}.`)

// ── 3. Merge ─────────────────────────────────────────────────────────────────

console.log('  Attempting fast-forward merge...')
let merged = false
try {
  git(['merge', '--ff-only', `${UPSTREAM}/${BRANCH}`], { stdio: 'inherit' })
  merged = true
} catch {
  console.log('\n  Fast-forward not possible (your branch has diverged).')
  console.log('  Falling back to a regular merge...')
  try {
    git(['merge', `${UPSTREAM}/${BRANCH}`], { stdio: 'inherit' })
    merged = true
  } catch {
    fail(
      'Merge hit conflicts. Resolve them, then run:\n' +
        '    git add -A && git commit\n' +
        '    npm run update   # to finish the build proof',
    )
  }
}

if (!merged) {
  fail('Merge did not complete. Resolve manually and re-run.')
}

// ── 4. Build proof ───────────────────────────────────────────────────────────

const smoke = join(ROOT, 'scripts', 'fork-smoke.sh')
console.log('\n  Running build proof...')
try {
  if (existsSync(smoke)) {
    execFileSync('bash', [smoke], { cwd: ROOT, stdio: 'inherit' })
  } else {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  }
} catch {
  fail(
    'Build proof failed after merge. Inspect the output above.\n' +
      '  Your merge is committed; fix the build, then continue.',
  )
}

// ── 5. Record + done ─────────────────────────────────────────────────────────

recordVersion()
console.log('\n  now current\n')

function recordVersion() {
  try {
    const sha = git(['rev-parse', `${UPSTREAM}/${BRANCH}`], { stdio: 'pipe' }).trim()
    writeFileSync(join(ROOT, '.inkwell-version'), `${sha}\n`)
  } catch {
    // Non-fatal: drift reporting just won't have a stored baseline.
  }
}
