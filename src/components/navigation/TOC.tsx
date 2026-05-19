'use client'

import { useEffect, useState } from 'react'

interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

export function TOC() {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const article = document.querySelector('article')
    if (!article) return

    const headings = article.querySelectorAll('h2, h3')
    const tocItems: TocItem[] = []

    headings.forEach((heading) => {
      if (!heading.id) {
        heading.id = heading.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') ?? ''
      }
      tocItems.push({
        id: heading.id,
        text: heading.textContent ?? '',
        level: heading.tagName === 'H2' ? 2 : 3,
      })
    })

    setItems(tocItems)
  }, [])

  useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav
      style={{
        position: 'sticky',
        top: '96px',
        maxHeight: 'calc(100vh - 8rem)',
        overflowY: 'auto',
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '12px',
          cursor: 'pointer',
          fontFamily: 'var(--ink-font-mono)',
          color: 'var(--ink-text-muted)',
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
      >
        <span>{collapsed ? '+' : '-'}</span>
        <span>On this page</span>
      </button>

      {!collapsed && (
        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderLeft: '1px solid var(--ink-border)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  display: 'block',
                  padding: '4px 0',
                  paddingLeft: item.level === 3 ? '24px' : '12px',
                  color: activeId === item.id ? 'var(--ink-primary)' : 'var(--ink-text-muted)',
                  borderLeft: activeId === item.id ? '2px solid var(--ink-primary)' : '2px solid transparent',
                  marginLeft: '-1px',
                  fontFamily: 'var(--ink-font-body)',
                  fontSize: item.level === 3 ? '13px' : '14px',
                  textDecoration: 'none',
                  transition: 'color 200ms ease',
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
