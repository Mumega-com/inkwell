import type { PluginManifest, McpToolDef } from '../../kernel/types'
import { feedbackRoutes } from './routes'

const feedbackTools: McpToolDef[] = [
  {
    name: 'get_feedback_summary',
    description: 'Get feedback insights — NPS score, top issues, category breakdown, sentiment trends. Tells you what users are saying about the product.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 30)' },
        survey_id: { type: 'string', description: 'Filter by specific survey ID' },
      },
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/feedback/insights?days=N', args }
    },
  },
  {
    name: 'trigger_survey',
    description: 'Trigger a survey for a specific path or context. Returns the survey definition for the client to display.',
    inputSchema: {
      type: 'object',
      properties: {
        survey_id: { type: 'string', description: 'Survey ID to trigger' },
        path: { type: 'string', description: 'Page path to show the survey on' },
      },
      required: ['survey_id'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call POST /api/feedback/trigger', args }
    },
  },
  {
    name: 'get_churn_signals',
    description: 'Get churn risk signals — declining engagement, negative sentiment trends, at-risk tenants. Returns actionable list.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Window to analyze (default 30)' },
      },
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/feedback/churn-signals?days=N', args }
    },
  },
]

const manifest: PluginManifest = {
  name: 'feedback',
  version: '1.0.0',
  description: 'Customer feedback system — NPS/CSAT surveys, micro-surveys, feature voting, LLM classification, churn signals',
  requiredRole: 'viewer',
  dashboardWidgets: ['FeedbackWidget', 'NpsWidget', 'FeatureVoteBoard'],
  mountRoutes: (app) => {
    app.route('/api/feedback', feedbackRoutes)
  },
  mcpTools: feedbackTools,
}

export default manifest
