/**
 * MCP (Model Context Protocol) endpoint — Streamable HTTP
 *
 * POST /mcp
 *
 * Implements JSON-RPC 2.0 with MCP methods:
 *   initialize   — handshake
 *   tools/list   — enumerate available tools (collected from all active plugins)
 *   tools/call   — invoke a tool (dispatched to owning plugin's handler)
 *
 * Auth: Bearer token must match INKWELL_MCP_TOKEN env var.
 *
 * Tool definitions live in each plugin's manifest (mcpTools property).
 * The kernel's collectMcpTools() gathers them at runtime.
 */

import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { collectMcpTools } from '../../kernel/plugin-loader'
import { config } from '../../inkwell.config'
import type { McpToolDef } from '../../kernel/types'

// ── JSON-RPC types ────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function err(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
}

function args(params: unknown): Record<string, unknown> {
  if (params && typeof params === 'object') {
    const p = params as Record<string, unknown>
    if (p.arguments && typeof p.arguments === 'object') {
      return p.arguments as Record<string, unknown>
    }
  }
  return {}
}

/** Strip handlers from tool defs for the tools/list response */
function toolsForListing(tools: McpToolDef[]): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}

// ── Route ─────────────────────────────────────────────────────────────────────

const mcpRoutes = new Hono<AppBindings>()

mcpRoutes.post('/', async (c) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const mcpToken = c.env.INKWELL_MCP_TOKEN
  if (mcpToken) {
    const auth = c.req.header('Authorization') ?? ''
    if (auth !== `Bearer ${mcpToken}`) {
      return c.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } } satisfies JsonRpcResponse,
        401,
      )
    }
  }

  // ── Parse request ─────────────────────────────────────────────────────────
  let rpc: JsonRpcRequest
  try {
    rpc = await c.req.json() as JsonRpcRequest
  } catch {
    return c.json(err(null, -32700, 'Parse error'))
  }

  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return c.json(err(rpc?.id ?? null, -32600, 'Invalid Request'))
  }

  const id = rpc.id ?? null

  // Collect all MCP tools from active plugins
  const allTools = collectMcpTools([...config.plugins])

  // ── Method dispatch ───────────────────────────────────────────────────────

  if (rpc.method === 'initialize') {
    return c.json(ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'inkwell-mcp', version: '1.0.0' },
    }))
  }

  if (rpc.method === 'tools/list') {
    return c.json(ok(id, { tools: toolsForListing(allTools) }))
  }

  if (rpc.method === 'tools/call') {
    const params = rpc.params as Record<string, unknown> | undefined
    const toolName = typeof params?.name === 'string' ? params.name : ''

    if (!toolName) return c.json(err(id, -32602, 'Invalid params: name required'))

    const tool = allTools.find(t => t.name === toolName)
    if (!tool) return c.json(err(id, -32602, `Unknown tool: ${toolName}`))

    const toolArgs = args(params)

    try {
      const result = await tool.handler(toolArgs, c.env)
      return c.json(ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))
    } catch (e) {
      console.error(`[mcp] tool ${toolName} failed:`, e)
      return c.json(err(id, -32603, 'Internal error'))
    }
  }

  return c.json(err(id, -32601, `Method not found: ${rpc.method}`))
})

export { mcpRoutes }
