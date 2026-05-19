'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        const article = document.querySelector('article')
        if (!article) {
          ticking = false
          return
        }

        const rect = article.getBoundingClientRect()
        const articleTop = rect.top + window.scrollY
        const articleHeight = article.scrollHeight
        const viewportHeight = window.innerHeight
        const scrolled = window.scrollY - articleTop
        const total = articleHeight - viewportHeight

        if (scrolled <= 0) {
          setProgress(0)
          setVisible(false)
        } else if (scrolled >= total) {
          setProgress(100)
          setVisible(true)
        } else {
          setProgress((scrolled / total) * 100)
          setVisible(true)
        }

        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div
      className="ink-progress-bar"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  )
}
