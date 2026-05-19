import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Textarea } from '../../../src/components/ui/textarea'
interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: Date
  toolName?: string
  toolData?: Record<string, unknown>
  isStreaming?: boolean
}

interface TaskCard {
  id: string
  title: string
  status: string
  priority?: string
  labels?: string[]
}

const STORAGE_KEYS = {
  apiUrl: 'inkwell_api_url',
  authToken: 'inkwell_auth_token',
  tenantSlug: 'inkwell_tenant_slug',
} as const

function TaskCardDisplay({ data }: { data: TaskCard }) {
  return (
    <Card className="border-l-4 border-l-[var(--ink-primary)] my-2">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide text-[var(--ink-primary)] border-[var(--ink-primary)]">
            Task Created
          </Badge>
          {data.priority && (
            <Badge variant="secondary" className="text-[0.65rem]">
              {data.priority}
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold text-[var(--ink-text)]">{data.title}</p>
        {data.id && (
          <p className="text-xs font-mono text-[var(--ink-muted)]">#{data.id}</p>
        )}
        {data.labels && data.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {data.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-[0.65rem] text-[var(--ink-muted)]">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ToolCallDisplay({ message }: { message: Message }) {
  if (message.toolName === 'task_create' && message.toolData) {
    return <TaskCardDisplay data={message.toolData as unknown as TaskCard} />
  }
  return (
    <Card className="my-1 bg-transparent border-[var(--ink-border)]">
      <CardContent className="p-2 flex items-start gap-2">
        <Badge variant="secondary" className="text-[0.65rem] shrink-0 mt-0.5">
          {message.toolName ?? 'tool'}
        </Badge>
        {message.content && (
          <span className="text-xs font-mono text-[var(--ink-muted)] break-all">{message.content}</span>
        )}
      </CardContent>
    </Card>
  )
}

function StreamingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[0.9em] bg-[var(--ink-primary)] ml-[2px] align-text-bottom"
      style={{ animation: 'inkwell-chat-blink 1s steps(1) infinite' }}
    />
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  if (isTool) {
    return <ToolCallDisplay message={message} />
  }

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Badge
          variant={isUser ? 'default' : 'secondary'}
          className="text-[0.6rem] uppercase tracking-wide px-1.5 py-0"
        >
          {isUser ? 'you' : 'ai'}
        </Badge>
        <span className="text-[0.65rem] text-[var(--ink-muted)] opacity-70">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <Card
        className={`max-w-[82%] ${
          isUser
            ? 'bg-[rgba(212,160,23,0.12)] border-[rgba(212,160,23,0.3)]'
            : 'bg-[var(--ink-surface)] border-[var(--ink-border)]'
        }`}
      >
        <CardContent className="p-3 text-sm leading-relaxed text-[var(--ink-text)] whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && <StreamingCursor />}
        </CardContent>
      </Card>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2 px-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--ink-muted)]"
          style={{ animation: `inkwell-chat-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

export function AssistantChat() {
  const [apiUrl, setApiUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load config from localStorage
  useEffect(() => {
    const url = localStorage.getItem(STORAGE_KEYS.apiUrl) ?? ''
    const token = localStorage.getItem(STORAGE_KEYS.authToken) ?? ''
    const slug = localStorage.getItem(STORAGE_KEYS.tenantSlug) ?? ''
    setApiUrl(url)
    setAuthToken(token)
    setTenantSlug(slug)
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your AI squad assistant${slug ? ` for ${slug}` : ''}. Ask me to create tasks, check status, run SEO audits, or anything else your squad can help with.`,
        timestamp: new Date(),
      },
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const assistantMsgId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ])

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${apiUrl}/my/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Tenant': tenantSlug,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const contentType = response.headers.get('content-type') ?? ''

      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No response body')

        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as {
                content?: string
                tool?: string
                tool_data?: Record<string, unknown>
              }
              if (parsed.tool) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `t-${Date.now()}-${Math.random()}`,
                    role: 'tool',
                    content: parsed.content ?? '',
                    timestamp: new Date(),
                    toolName: parsed.tool,
                    toolData: parsed.tool_data,
                  },
                ])
              } else if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                )
              }
            } catch {
              // plain text chunk
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + line } : m
                )
              )
            }
          }
        }
      } else {
        const data = (await response.json()) as {
          reply?: string
          content?: string
          message?: string
          tools?: Array<{ name: string; data: Record<string, unknown>; result: string }>
        }
        const replyText = data.reply ?? data.content ?? data.message ?? 'Done.'

        if (data.tools && Array.isArray(data.tools)) {
          const toolMsgs: Message[] = data.tools.map((t) => ({
            id: `t-${Date.now()}-${Math.random()}`,
            role: 'tool' as const,
            content: t.result ?? '',
            timestamp: new Date(),
            toolName: t.name,
            toolData: t.data,
          }))
          setMessages((prev) => [...prev, ...toolMsgs])
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: replyText } : m))
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `Sorry, I couldn't reach the assistant right now. (${(err as Error).message})` }
            : m
        )
      )
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      )
      setIsLoading(false)
    }
  }, [input, isLoading, messages, apiUrl, authToken, tenantSlug])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    )
    setIsLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes inkwell-chat-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes inkwell-chat-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>

      <Card className="flex flex-col h-full min-h-[500px] overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-[var(--ink-border)] bg-[var(--ink-surface)] shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <span
              className="w-2 h-2 rounded-full bg-[var(--ink-accent,#10B981)] shrink-0"
              style={{ boxShadow: '0 0 6px var(--ink-accent,#10B981)' }}
            />
            AI Squad
            {tenantSlug && (
              <span className="ml-auto text-xs font-mono font-normal text-[var(--ink-muted)]">
                {tenantSlug}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0"
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && messages[messages.length - 1]?.isStreaming === false && (
            <TypingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-[var(--ink-border)] bg-[var(--ink-surface)] flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your squad anything… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
            className="flex-1 min-h-[38px] max-h-[160px] resize-none text-sm bg-[var(--ink-bg)] border-[var(--ink-border)] text-[var(--ink-text)] placeholder:text-[var(--ink-muted)] focus-visible:ring-[var(--ink-primary)] focus-visible:border-[var(--ink-primary)]"
          />
          {isLoading ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="shrink-0 h-[38px]"
            >
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void sendMessage()}
              disabled={!input.trim()}
              className="shrink-0 h-[38px] bg-transparent text-[var(--ink-primary)] border border-[var(--ink-primary)] hover:bg-[var(--ink-primary)] hover:text-[var(--ink-bg)] transition-colors"
            >
              Send ↵
            </Button>
          )}
        </div>
      </Card>
    </>
  )
}
