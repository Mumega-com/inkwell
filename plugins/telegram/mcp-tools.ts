import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const telegramMcpTools: McpToolDef[] = [
  {
    name: 'send_telegram',
    description: 'Send a message via Telegram bot',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Message text (Markdown supported)' },
        chat_id: { type: 'string', description: 'Override the default chat ID (optional)' },
      },
      required: ['text'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const token = env.TELEGRAM_BOT_TOKEN
      if (!token) return { error: 'telegram_not_configured' }

      const text = typeof a.text === 'string' ? a.text.trim() : ''
      if (!text) return { error: 'text required' }

      const chatId = typeof a.chat_id === 'string' ? a.chat_id : env.TELEGRAM_CHAT_ID
      if (!chatId) return { error: 'no_chat_id_configured' }

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
        })
        const data = await res.json() as { ok: boolean; description?: string }
        if (!data.ok) return { error: 'telegram_error', description: data.description }
        return { ok: true }
      } catch {
        return { error: 'telegram_unreachable' }
      }
    },
  },
]
