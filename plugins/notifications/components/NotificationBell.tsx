import { useState, useEffect, useCallback } from 'react'
import { Button } from '../../../src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'

interface ActivityItem {
  id: string
  item_type: 'task' | 'event'
  detail: string
  ts: string | null
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function itemIcon(type: string): string {
  return type === 'task' ? '✓' : '◈'
}

const LAST_READ_KEY = 'inkwell_notifications_last_read'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRead, setLastRead] = useState<number>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_READ_KEY) : null
    return stored ? parseInt(stored, 10) : 0
  })

  const fetchActivity = useCallback(async () => {
    const apiUrl = localStorage.getItem('inkwell_api_url') || ''
    const token = localStorage.getItem('inkwell_auth_token') || ''
    if (!apiUrl || !token) return

    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/my/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json() as { activity: ActivityItem[] }
      setItems((data.activity || []).slice(0, 10))
    } catch {
      // best effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const unreadCount = items.filter(item => {
    if (!item.ts) return false
    return new Date(item.ts).getTime() > lastRead
  }).length

  function markAllRead() {
    const now = Date.now()
    setLastRead(now)
    localStorage.setItem(LAST_READ_KEY, String(now))
  }

  function toggleOpen() {
    setOpen(prev => !prev)
    if (!open) fetchActivity()
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{ position: 'relative', padding: '0.4rem 0.6rem', fontSize: '1.1rem' }}
      >
        🔔
        {unreadCount > 0 && (
          <Badge
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              fontSize: '0.6rem',
              padding: '1px 4px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--ink-primary)',
              color: '#000',
              borderRadius: '8px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <Card
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            zIndex: 200,
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <CardHeader
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--ink-border)',
            }}
          >
            <CardTitle style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-text)' }}>
              Notifications
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--ink-muted)' }}
            >
              Mark all read
            </Button>
          </CardHeader>

          <CardContent style={{ padding: 0 }}>
            {loading && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
                Loading…
              </div>
            )}

            {!loading && items.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
                No recent activity
              </div>
            )}

            {!loading && items.map(item => {
              const isUnread = item.ts ? new Date(item.ts).getTime() > lastRead : false
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.65rem 1rem',
                    borderBottom: '1px solid var(--ink-border)',
                    background: isUnread ? 'rgba(212,160,23,0.05)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: item.item_type === 'task' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                      marginTop: '2px',
                      flexShrink: 0,
                    }}
                  >
                    {itemIcon(item.item_type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--ink-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: isUnread ? 600 : 400,
                      }}
                    >
                      {item.detail}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                      {timeAgo(item.ts)}
                    </p>
                  </div>
                  {isUnread && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--ink-primary)',
                        flexShrink: 0,
                        marginTop: '6px',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
