'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Chapter {
  time: number
  title: string
}

interface VideoHeroProps {
  src: string
  poster?: string
  chapters?: Chapter[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoHero({ src, poster, chapters }: VideoHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)

  // Autoplay muted when scrolled into view
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current
        if (!video) return

        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay blocked by browser
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().catch(() => {})
      setPlaying(true)
      setShowOverlay(false)
    } else {
      video.pause()
      setPlaying(false)
      setShowOverlay(true)
    }
  }, [])

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    video.play().catch(() => {})
    setPlaying(true)
    setShowOverlay(false)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
      }}
    >
      {/* Video */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '8px',
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1px solid var(--ink-border)',
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          playsInline
          loop
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onPlay={() => {
            setPlaying(true)
            setShowOverlay(false)
          }}
          onPause={() => {
            setPlaying(false)
            setShowOverlay(true)
          }}
        />

        {/* Play/pause overlay */}
        {showOverlay && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)',
              transition: 'opacity 300ms ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--ink-primary)',
                color: 'var(--ink-bg)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Chapters sidebar */}
      {chapters && chapters.length > 0 && (
        <div
          style={{
            borderRadius: '8px',
            overflowY: 'auto',
            maxHeight: '320px',
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '12px 16px 8px',
              margin: 0,
              color: 'var(--ink-text-dim)',
              fontFamily: 'var(--ink-font-mono)',
            }}
          >
            Chapters
          </p>
          <ul style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' }}>
            {chapters.map((chapter, i) => (
              <li key={i}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    seekTo(chapter.time)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background 200ms ease',
                    cursor: 'pointer',
                    color: 'var(--ink-text-muted)',
                    background: 'transparent',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      flexShrink: 0,
                      color: 'var(--ink-primary)',
                      fontFamily: 'var(--ink-font-mono)',
                    }}
                  >
                    {formatTime(chapter.time)}
                  </span>
                  <span>{chapter.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
