// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  currentPath: string
  navigate: (path: string) => void
}

interface Tab {
  label: string
  icon: string
  path: string
  // Suffix used to detect active state (e.g. '' for home, 'checkin', etc.)
  suffix: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalNav({ slug, currentPath, navigate }: Props) {
  const tabs: Tab[] = [
    { label: 'Home', icon: '⌂', path: `/portal/${slug}`, suffix: '' },
    { label: 'Check-in', icon: '✦', path: `/portal/${slug}/checkin`, suffix: 'checkin' },
    { label: 'Tasks', icon: '☐', path: `/portal/${slug}/tasks`, suffix: 'tasks' },
    { label: 'Invoices', icon: '◈', path: `/portal/${slug}/invoices`, suffix: 'invoices' },
    { label: 'Activity', icon: '◎', path: `/portal/${slug}/activity`, suffix: 'activity' },
    { label: 'Settings', icon: '⚙', path: `/portal/${slug}/settings`, suffix: 'settings' },
  ]

  function isActive(tab: Tab): boolean {
    const normalised = currentPath.replace(/\/$/, '')
    const base = `/portal/${slug}`
    if (tab.suffix === '') {
      // Home tab — active only when exactly on base path
      return normalised === base
    }
    return normalised === `${base}/${tab.suffix}`
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        background: 'var(--ink-surface)',
        borderTop: '1px solid var(--ink-border)',
        display: 'flex',
        alignItems: 'stretch',
        // iOS home indicator clearance
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab)
        return (
          <button
            key={tab.suffix}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '10px 4px 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
              fontWeight: active ? '700' : '400',
              transition: 'color 0.15s',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                lineHeight: '1',
                // Slightly brighten active icon
                opacity: active ? 1 : 0.65,
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                lineHeight: '1',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
