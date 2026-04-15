/**
 * Upload local files to the R2 bucket `inkwell-media` via Cloudflare API.
 *
 * Usage: npm run upload -- --file public/media/blog/homepage.png --key media/blog/homepage.png
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const R2_BUCKET = 'inkwell-media'

function usage(): never {
  process.stderr.write(
    'Usage: npm run upload -- --file <local-path> --key <r2-key>\n\n' +
      'Env vars required:\n' +
      '  CLOUDFLARE_API_TOKEN\n' +
      '  CLOUDFLARE_ACCOUNT_ID\n',
  )
  process.exit(1)
}

function parseArgs(argv: string[]): { file: string; key: string } {
  let file = ''
  let key = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      file = argv[++i]
    } else if (argv[i] === '--key' && argv[i + 1]) {
      key = argv[++i]
    }
  }
  if (!file || !key) usage()
  return { file, key }
}

async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!apiToken || !accountId) {
    process.stderr.write('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID\n')
    process.exit(1)
  }

  const { file, key } = parseArgs(process.argv.slice(2))
  const filePath = resolve(file)

  let body: Buffer
  try {
    body = readFileSync(filePath)
  } catch {
    process.stderr.write(`Cannot read file: ${filePath}\n`)
    process.exit(1)
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: new Uint8Array(body),
  })

  if (!res.ok) {
    const text = await res.text()
    process.stderr.write(`Upload failed (${res.status}): ${text}\n`)
    process.exit(1)
  }

  process.stdout.write(`Uploaded ${filePath} -> r2://${R2_BUCKET}/${key}\n`)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})
