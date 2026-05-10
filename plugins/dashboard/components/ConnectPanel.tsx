import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../src/components/ui/tabs'
import { cn } from '../../../src/lib/utils'

interface PlatformConfig {
  platform: 'claude_code' | 'claude_desktop' | 'cursor' | 'chatgpt'
  label: string
  config: string
}

interface ConnectData {
  mcp_url?: string
  token?: string
  platforms?: PlatformConfig[]
}

const PLATFORM_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  claude_desktop: 'Claude Desktop',
  cursor: 'Cursor',
  chatgpt: 'ChatGPT / OpenAI',
}

const PLATFORM_ICONS: Record<string, string> = {
  claude_code: '◉',
  claude_desktop: '◎',
  cursor: '⊕',
  chatgpt: '◈',
}

function buildDefaultPlatforms(mcpUrl: string): PlatformConfig[] {
  const claudeConfig = JSON.stringify(
    { mcpServers: { inkwell: { url: mcpUrl } } },
    null,
    2
  )
  const chatgptConfig = JSON.stringify(
    { tools: [{ type: 'mcp', server_url: mcpUrl }] },
    null,
    2
  )

  return [
    {
      platform: 'claude_code',
      label: 'Claude Code',
      config: `# Add to ~/.claude/mcp.json or mcp.json in your project root:\n${claudeConfig}`,
    },
    {
      platform: 'claude_desktop',
      label: 'Claude Desktop',
      config: `# Add to your claude_desktop_config.json:\n${claudeConfig}`,
    },
    {
      platform: 'cursor',
      label: 'Cursor',
      config: `# Add to .cursor/mcp.json in your project:\n${claudeConfig}`,
    },
    {
      platform: 'chatgpt',
      label: 'ChatGPT',
      config: `# In ChatGPT tool settings, add an MCP server:\n${chatgptConfig}`,
    },
  ]
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback: no-op
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        'shrink-0 text-xs',
        copied && 'border-emerald-500/50 text-emerald-500',
        className
      )}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </Button>
  )
}

function ConfigBlock({ pc }: { pc: PlatformConfig }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="opacity-60">{PLATFORM_ICONS[pc.platform] ?? '◉'}</span>
        <span className="flex-1 text-sm font-semibold">
          {PLATFORM_LABELS[pc.platform] ?? pc.label}
        </span>
        <CopyButton text={pc.config} />
      </div>
      <pre className="overflow-x-auto bg-black/25 px-4 py-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre">
        {pc.config}
      </pre>
    </div>
  )
}

export function ConnectPanel({ apiUrl, authToken }: { apiUrl: string; authToken: string }) {
  const [data, setData] = useState<ConnectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${apiUrl}/my/connect`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((d: ConnectData) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [apiUrl, authToken])

  const platforms: PlatformConfig[] = data?.platforms?.length
    ? data.platforms
    : data?.mcp_url
      ? buildDefaultPlatforms(data.mcp_url)
      : []

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Intro card with MCP URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect an AI Agent</CardTitle>
          <CardDescription>
            Add this MCP server config to your AI tool of choice. Your agent will be able to
            publish content, check SEO data, manage leads, and run your dashboard — all through
            natural language.
          </CardDescription>
        </CardHeader>

        {data?.mcp_url && (
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground">MCP URL</span>
              <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 font-mono text-xs text-amber-500">
                {data.mcp_url}
              </code>
              <CopyButton text={data.mcp_url} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Platform config tabs */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading connection details…</p>
      ) : error ? (
        <p className="text-sm text-red-500">
          Could not load connection details. Check your API URL.
        </p>
      ) : platforms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No connection data returned from the API.
        </p>
      ) : (
        <Tabs defaultValue={platforms[0].platform}>
          <TabsList className="mb-4 flex w-full">
            {platforms.map((pc) => (
              <TabsTrigger key={pc.platform} value={pc.platform} className="flex-1 text-xs">
                {PLATFORM_LABELS[pc.platform] ?? pc.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {platforms.map((pc) => (
            <TabsContent key={pc.platform} value={pc.platform}>
              <ConfigBlock pc={pc} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
