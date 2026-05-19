/**
 * Inkwell Animation Runtime
 * Reusable Stage / Sprite / Timeline system ported from animations.jsx
 * Works as a React island (client:load / client:visible).
 */

'use client'

import React from 'react'

// ── Easing ────────────────────────────────────────────────────────────────────

export const Easing = {
  linear: (t: number) => t,
  easeInQuad:    (t: number) => t * t,
  easeOutQuad:   (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic:   (t: number) => t * t * t,
  easeOutCubic:  (t: number) => { const u = t - 1; return u * u * u + 1 },
  easeInOutCubic:(t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart:   (t: number) => t * t * t * t,
  easeOutQuart:  (t: number) => { const u = t - 1; return 1 - u * u * u * u },
  easeOutExpo:   (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeOutSine:   (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function interpolate(
  input: number[],
  output: number[],
  ease: ((t: number) => number) | ((t: number) => number)[] = Easing.linear
): (t: number) => number {
  return (t: number) => {
    if (t <= input[0]) return output[0]
    if (t >= input[input.length - 1]) return output[output.length - 1]
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i]
        const local = span === 0 ? 0 : (t - input[i]) / span
        const easeFn = Array.isArray(ease) ? (ease[i] ?? Easing.linear) : ease
        const eased = easeFn(local)
        return output[i] + (output[i + 1] - output[i]) * eased
      }
    }
    return output[output.length - 1]
  }
}

export function animate({
  from = 0,
  to = 1,
  start = 0,
  end = 1,
  ease = Easing.easeInOutCubic,
}: {
  from?: number
  to?: number
  start?: number
  end?: number
  ease?: (t: number) => number
}) {
  return (t: number) => {
    if (t <= start) return from
    if (t >= end) return to
    const local = (t - start) / (end - start)
    return from + (to - from) * ease(local)
  }
}

// ── Timeline context ──────────────────────────────────────────────────────────

export interface TimelineValue {
  time: number
  duration: number
  playing: boolean
  setTime: (t: number) => void
  setPlaying: (p: boolean | ((prev: boolean) => boolean)) => void
}

export const TimelineContext = React.createContext<TimelineValue>({
  time: 0,
  duration: 10,
  playing: false,
  setTime: () => {},
  setPlaying: () => {},
})

export const useTime = () => React.useContext(TimelineContext).time
export const useTimeline = () => React.useContext(TimelineContext)

// ── Sprite context ────────────────────────────────────────────────────────────

export interface SpriteValue {
  localTime: number
  progress: number
  duration: number
  visible: boolean
}

export const SpriteContext = React.createContext<SpriteValue>({
  localTime: 0,
  progress: 0,
  duration: 0,
  visible: false,
})

export const useSprite = () => React.useContext(SpriteContext)

export function Sprite({
  start = 0,
  end = Infinity,
  children,
  keepMounted = false,
}: {
  start?: number
  end?: number
  children: React.ReactNode | ((v: SpriteValue) => React.ReactNode)
  keepMounted?: boolean
}) {
  const { time } = useTimeline()
  const visible = time >= start && time <= end
  if (!visible && !keepMounted) return null

  const duration = end - start
  const localTime = Math.max(0, time - start)
  const progress = duration > 0 && isFinite(duration)
    ? clamp(localTime / duration, 0, 1)
    : 0

  const value: SpriteValue = { localTime, progress, duration, visible }

  return React.createElement(
    SpriteContext.Provider,
    { value },
    typeof children === 'function' ? children(value) : children
  )
}

// ── Stage ─────────────────────────────────────────────────────────────────────

export function Stage({
  width = 1280,
  height = 720,
  duration = 10,
  background = '#f6f4ef',
  loop = true,
  autoplay = true,
  showControls = true,
  persistKey = 'animstage',
  children,
}: {
  width?: number
  height?: number
  duration?: number
  background?: string
  loop?: boolean
  autoplay?: boolean
  showControls?: boolean
  persistKey?: string
  children?: React.ReactNode
}) {
  const [time, setTime] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ':t') ?? '0')
      return isFinite(v) ? clamp(v, 0, duration) : 0
    } catch { return 0 }
  })
  const [playing, setPlaying] = React.useState(autoplay)
  const [hoverTime, setHoverTime] = React.useState<number | null>(null)
  const [scale, setScale] = React.useState(1)

  const stageRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastTsRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    try { localStorage.setItem(persistKey + ':t', String(time)) } catch {}
  }, [time, persistKey])

  React.useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const barH = showControls ? 44 : 0
    const measure = () => {
      const s = Math.min(el.clientWidth / width, (el.clientHeight - barH) / height)
      setScale(Math.max(0.05, s))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [width, height, showControls])

  React.useEffect(() => {
    if (!playing) { lastTsRef.current = null; return }
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setTime((t) => {
        let next = t + dt
        if (next >= duration) {
          if (loop) next = next % duration
          else { next = duration; setPlaying(false) }
        }
        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTsRef.current = null
    }
  }, [playing, duration, loop])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p) }
      else if (e.code === 'ArrowLeft') setTime(t => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration))
      else if (e.code === 'ArrowRight') setTime(t => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration))
      else if (e.key === '0' || e.code === 'Home') setTime(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [duration])

  const displayTime = hoverTime != null ? hoverTime : time

  const ctxValue = React.useMemo<TimelineValue>(
    () => ({ time: displayTime, duration, playing, setTime, setPlaying }),
    [displayTime, duration, playing]
  )

  return React.createElement(
    'div',
    {
      ref: stageRef,
      style: {
        position: 'relative' as const,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        background: '#0a0a0a',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
        },
      },
      React.createElement(
        'div',
        {
          style: {
            width,
            height,
            background,
            position: 'relative' as const,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          },
        },
        React.createElement(TimelineContext.Provider, { value: ctxValue }, children)
      )
    ),
    showControls && React.createElement(PlaybackBar, {
      time: displayTime,
      duration,
      playing,
      onPlayPause: () => setPlaying(p => !p),
      onReset: () => setTime(0),
      onSeek: setTime,
      onHover: setHoverTime,
    })
  )
}

// ── PlaybackBar ───────────────────────────────────────────────────────────────

function PlaybackBar({
  time,
  duration,
  playing,
  onPlayPause,
  onReset,
  onSeek,
  onHover,
}: {
  time: number
  duration: number
  playing: boolean
  onPlayPause: () => void
  onReset: () => void
  onSeek: (t: number) => void
  onHover: (t: number | null) => void
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const timeFromEvent = React.useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    return x * duration
  }, [duration])

  React.useEffect(() => {
    if (!dragging) return
    const onUp = () => setDragging(false)
    const onMove = (e: MouseEvent) => onSeek(timeFromEvent(e))
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove) }
  }, [dragging, timeFromEvent, onSeek])

  const pct = duration > 0 ? (time / duration) * 100 : 0
  const fmt = (t: number) => {
    const total = Math.max(0, t)
    const m = Math.floor(total / 60)
    const s = Math.floor(total % 60)
    const cs = Math.floor((total * 100) % 100)
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }

  const mono = 'JetBrains Mono, ui-monospace, monospace'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px',
      background: 'rgba(20,20,20,0.92)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
      maxWidth: 680,
      alignSelf: 'center',
      borderRadius: 8,
      color: '#f6f4ef',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      <BarButton onClick={onReset} title="Return to start (0)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </BarButton>
      <BarButton onClick={onPlayPause} title="Play/pause (space)">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" fill="currentColor"/>
            <rect x="8" y="2" width="3" height="10" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
          </svg>
        )}
      </BarButton>
      <div style={{ fontFamily: mono, fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 64, textAlign: 'right', color: '#f6f4ef' }}>
        {fmt(time)}
      </div>
      <div
        ref={trackRef}
        onMouseMove={(e) => { if (dragging) onSeek(timeFromEvent(e)); else onHover(timeFromEvent(e)) }}
        onMouseLeave={() => { if (!dragging) onHover(null) }}
        onMouseDown={(e) => { setDragging(true); onSeek(timeFromEvent(e)); onHover(null) }}
        style={{ flex: 1, height: 22, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, background: 'oklch(72% 0.12 250)', borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 12, height: 12, marginLeft: -6, marginTop: -6, background: '#fff', borderRadius: 6, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}/>
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 64, textAlign: 'left', color: 'rgba(246,244,239,0.55)' }}>
        {fmt(duration)}
      </div>
    </div>
  )
}

function BarButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: '#f6f4ef',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  )
}
