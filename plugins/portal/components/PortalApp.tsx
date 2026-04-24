import { useState, useEffect, useCallback } from 'react'
import LoginView from './LoginView'
import HomeView from './HomeView'
import CheckInView from './CheckInView'
import HistoryView from './HistoryView'
import TasksView from './TasksView'
import InvoicesView from './InvoicesView'
import ActivityView from './ActivityView'
import SettingsView from './SettingsView'
import PortalNav from './PortalNav'

// ── Types ────────────────────────────────────────────────────────────────────

type View = 'login' | 'home' | 'checkin' | 'history' | 'tasks' | 'invoices' | 'activity' | 'settings'

interface RouteState {
  view: View
  slug: string
  path: string
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

function parsePath(pathname: string): RouteState {
  // Strip leading slash and split
  const parts = pathname.replace(/^\//, '').split('/')
  // Expected: ['portal', slug?, subpath?]
  if (parts[0] !== 'portal' || !parts[1]) {
    return { view: 'login', slug: '', path: pathname }
  }
  const slug = parts[1]
  const sub = parts[2] ?? ''

  let view: View = 'home'
  if (sub === 'checkin') view = 'checkin'
  else if (sub === 'history') view = 'history'
  else if (sub === 'tasks') view = 'tasks'
  else if (sub === 'invoices') view = 'invoices'
  else if (sub === 'activity') view = 'activity'
  else if (sub === 'settings') view = 'settings'

  return { view, slug, path: pathname }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalApp() {
  const [route, setRoute] = useState<RouteState>(() =>
    parsePath(window.location.pathname)
  )
  const [authChecked, setAuthChecked] = useState(false)
  const [config, setConfig] = useState<Record<string, unknown>>({})

  // Fetch portal config on mount and apply visual overrides
  useEffect(() => {
    apiFetch('/api/portal/config')
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, unknown>>) : Promise.resolve({})))
      .then((cfg) => {
        setConfig(cfg)
        if (typeof cfg.brandName === 'string') {
          document.title = cfg.brandName
        }
        if (typeof cfg.accentColor === 'string') {
          document.documentElement.style.setProperty('--ink-primary', cfg.accentColor)
        }
      })
      .catch(() => {})
  }, [])

  // Check auth on mount
  useEffect(() => {
    apiFetch('/api/portal/me')
      .then((res) => {
        if (res.status === 401 || !res.ok) {
          setRoute({ view: 'login', slug: '', path: window.location.pathname })
        } else {
          setRoute(parsePath(window.location.pathname))
        }
      })
      .catch(() => {
        setRoute({ view: 'login', slug: '', path: window.location.pathname })
      })
      .finally(() => setAuthChecked(true))
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path)
    setRoute(parsePath(path))
  }, [])

  const handleConfigUpdate = useCallback((updated: Record<string, unknown>) => {
    setConfig(updated)
    if (typeof updated.brandName === 'string') {
      document.title = updated.brandName
    }
    if (typeof updated.accentColor === 'string') {
      document.documentElement.style.setProperty('--ink-primary', updated.accentColor)
    }
  }, [])

  if (!authChecked) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          minHeight: '100vh',
          background: 'var(--ink-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-muted)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading…
      </div>
    )
  }

  const isLogin = route.view === 'login'

  const renderView = () => {
    switch (route.view) {
      case 'login':
        return <LoginView navigate={navigate} />
      case 'home':
        return <HomeView slug={route.slug} navigate={navigate} />
      case 'checkin':
        return <CheckInView slug={route.slug} />
      case 'history':
        return <HistoryView slug={route.slug} />
      case 'tasks':
        return <TasksView slug={route.slug} />
      case 'invoices':
        return <InvoicesView slug={route.slug} />
      case 'activity':
        return <ActivityView slug={route.slug} />
      case 'settings':
        return <SettingsView config={config} onConfigUpdate={handleConfigUpdate} />
    }
  }

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--ink-bg)',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--ink-text)',
        // Account for fixed bottom nav
        paddingBottom: isLogin ? '0' : '72px',
      }}
    >
      {renderView()}
      {!isLogin && (
        <PortalNav
          slug={route.slug}
          currentPath={route.path}
          navigate={navigate}
        />
      )}
    </div>
  )
}
