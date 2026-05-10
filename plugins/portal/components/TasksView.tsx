import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
}

type TaskStatus = 'open' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  status: TaskStatus | string
  agent?: string
  createdAt?: string
  created_at?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    credentials: 'include',
  })
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  let color: string
  let bg: string
  let label: string

  switch (status) {
    case 'in_progress':
      color = '#000'
      bg = 'var(--ink-secondary)'
      label = 'In progress'
      break
    case 'done':
      color = 'var(--ink-primary)'
      bg = 'transparent'
      label = 'Done'
      break
    default: // open
      color = 'var(--ink-muted)'
      bg = 'transparent'
      label = 'Open'
  }

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: '600',
        color,
        background: bg,
        border: `1px solid ${status === 'in_progress' ? 'var(--ink-secondary)' : 'var(--ink-border)'}`,
        borderRadius: '4px',
        padding: '2px 7px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TasksView({ slug }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/portal/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setTasks((data as { tasks?: Task[] }).tasks ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        Loading tasks…
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      <h2
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 20px',
        }}
      >
        Tasks
      </h2>

      {tasks.length === 0 ? (
        <div
          style={{
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '12px',
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--ink-muted)', fontSize: '15px', margin: '0' }}>
            No open tasks right now — your team is on it.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((task) => {
            const dateStr = task.createdAt ?? task.created_at
            return (
              <div
                key={task.id}
                style={{
                  background: 'var(--ink-surface)',
                  border: '1px solid var(--ink-border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: task.agent || dateStr ? '8px' : '0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--ink-text)',
                      lineHeight: '1.4',
                      flex: 1,
                    }}
                  >
                    {task.title}
                  </span>
                  <StatusBadge status={task.status} />
                </div>

                {(task.agent || dateStr) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {task.agent && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--ink-muted)',
                        }}
                      >
                        {task.agent}
                      </span>
                    )}
                    {dateStr && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--ink-muted)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatDate(dateStr)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
