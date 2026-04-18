import type { PluginManifest, McpToolDef } from '../../kernel/types'
import { mediaRoutes } from './routes'

const mediaTools: McpToolDef[] = [
  {
    name: 'upload_media',
    description: 'Upload an image or video from a URL. Stores in R2, runs AI analysis (alt text, tags, NSFW), creates knowledge graph node. Returns asset metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL of the image or video to upload' },
        filename: { type: 'string', description: 'Filename for the asset (e.g. hero-banner.jpg)' },
      },
      required: ['url', 'filename'],
    },
    handler: async (args, _env) => {
      // MCP tools run in the Worker context — route through the API
      // The actual implementation is in POST /api/media/upload
      return { error: 'use_api', message: 'Call POST /api/media/upload with multipart form data', args }
    },
  },
  {
    name: 'describe_image',
    description: 'Run AI vision analysis on an uploaded image. Returns alt text, description, tags, and NSFW score.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The media asset ID to analyze' },
      },
      required: ['asset_id'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call POST /api/media/{id}/describe', args }
    },
  },
  {
    name: 'generate_image',
    description: 'Generate an image from a text prompt using AI (Flux model). Stores result as a media asset with full metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description of the image to generate' },
      },
      required: ['prompt'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call POST /api/media/generate', args }
    },
  },
  {
    name: 'search_media',
    description: 'Search media assets by text query. Matches against alt text, description, tags, and transcripts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/media?q={query}', args }
    },
  },
]

const manifest: PluginManifest = {
  name: 'media',
  version: '1.0.0',
  description: 'AI-powered media pipeline — upload, analyze, transform, transcribe, generate',
  requiredRole: 'member',
  mountRoutes: (app) => {
    app.route('/api/media', mediaRoutes)
  },
  mcpTools: mediaTools,
}

export default manifest
