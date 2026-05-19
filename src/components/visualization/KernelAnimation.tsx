'use client'

/**
 * KernelAnimation — 48s retro CRT walkthrough of the Inkwell microkernel
 * 7 scenes: Boot · Plugins Load · Ports Bind · HTTP Route · Event Bus · MCP Call · Hot-Swap
 *
 * Ported from kernel_scenes.jsx (design bundle).
 * Uses Stage / Sprite / useTime / useSprite from ../../lib/animation
 */

import React from 'react'
import { Stage, Sprite, useTime, useSprite, animate, clamp, interpolate, Easing } from '../../lib/animation.tsx'

// ── Design tokens ─────────────────────────────────────────────────────────────

const OF = {
  bg:          '#0a0604',
  stage:       '#120a04',
  frame:       '#ff7a1a',
  frameDim:    '#b8520f',
  orange:      '#ffa04d',
  orangeBright:'#ffbf7a',
  cyan:        '#3de3ff',
  cyanDim:     '#1a8ba3',
  cyanBright:  '#8ff4ff',
  ink:         '#ffd9b3',
  red:         '#ff4a3d',
  green:       '#4dff9f',
  yellow:      '#ffd23d',
  bgCard:      '#1a0d05',
  bgCardAlt:   '#231208',
} as const

const FONT_PIXEL = "'VT323', 'Share Tech Mono', monospace"
const FONT_MONO  = "'Share Tech Mono', 'VT323', monospace"

// ── Data ──────────────────────────────────────────────────────────────────────

interface PluginDef {
  name: string
  kind: 'surface' | 'service' | 'ai'
  color: string
}

const PLUGINS: PluginDef[] = [
  { name: 'content',       kind: 'surface', color: OF.orange },
  { name: 'dashboard',     kind: 'surface', color: OF.orange },
  { name: 'commerce',      kind: 'surface', color: OF.orange },
  { name: 'auth',          kind: 'surface', color: OF.orange },
  { name: 'contracts',     kind: 'surface', color: OF.orange },
  { name: 'courses',       kind: 'surface', color: OF.orange },
  { name: 'payments',      kind: 'service', color: OF.cyan },
  { name: 'notifications', kind: 'service', color: OF.cyan },
  { name: 'sync',          kind: 'service', color: OF.cyan },
  { name: 'analytics',     kind: 'service', color: OF.cyan },
  { name: 'seo',           kind: 'service', color: OF.cyan },
  { name: 'media',         kind: 'service', color: OF.cyan },
  { name: 'crm',           kind: 'service', color: OF.cyan },
  { name: 'discovery',     kind: 'service', color: OF.cyan },
  { name: 'diagnostics',   kind: 'service', color: OF.cyan },
  { name: 'mcp',           kind: 'ai',      color: OF.green },
  { name: 'chat',          kind: 'ai',      color: OF.green },
  { name: 'telegram',      kind: 'ai',      color: OF.green },
  { name: 'agency',        kind: 'ai',      color: OF.green },
  { name: 'automation',    kind: 'ai',      color: OF.green },
  { name: 'onboarding',    kind: 'surface', color: OF.orange },
  { name: 'questionnaire', kind: 'surface', color: OF.orange },
  { name: 'organism',      kind: 'service', color: OF.cyan },
  { name: 'feedback',      kind: 'surface', color: OF.orange },
]

const PORTS: string[] = [
  'session', 'content', 'contentSource', 'media', 'storage', 'graph', 'agent',
  'bus', 'memory', 'economy', 'payments', 'notifications', 'auth', 'analytics',
]

// ── Shared atoms ──────────────────────────────────────────────────────────────

interface PanelProps {
  x: number; y: number; w: number; h: number
  border?: string; bg?: string; title?: string
  children?: React.ReactNode
  corner?: boolean; glow?: boolean; dashed?: boolean
}

function Panel({ x, y, w, h, border = OF.frame, bg = OF.stage, title, children, corner = true, glow = false, dashed = false }: PanelProps) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      background: bg,
      border: `2px ${dashed ? 'dashed' : 'solid'} ${border}`,
      boxShadow: glow ? `0 0 16px ${border}55, inset 0 0 24px ${border}15` : `inset 0 0 18px ${border}10`,
      fontFamily: FONT_PIXEL,
      color: OF.ink,
    }}>
      {corner && <>
        <CornerTick pos="tl" color={border} />
        <CornerTick pos="tr" color={border} />
        <CornerTick pos="bl" color={border} />
        <CornerTick pos="br" color={border} />
      </>}
      {title && (
        <div style={{
          position: 'absolute', top: -11, left: 14,
          background: bg, padding: '0 8px',
          fontSize: 18, color: border,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>{title}</div>
      )}
      {children}
    </div>
  )
}

function CornerTick({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const s = 6
  const base: React.CSSProperties = { position: 'absolute', width: s, height: s, background: color }
  const map: Record<string, React.CSSProperties> = {
    tl: { top: -2, left: -2 },
    tr: { top: -2, right: -2 },
    bl: { bottom: -2, left: -2 },
    br: { bottom: -2, right: -2 },
  }
  return <div style={{ ...base, ...map[pos] }} />
}

function Scanlines({ x = 0, y = 0, w, h }: { x?: number; y?: number; w: number; h: number }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      pointerEvents: 'none',
      background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)',
      mixBlendMode: 'multiply',
      zIndex: 50,
    }} />
  )
}

function Phosphor({ x = 0, y = 0, w, h }: { x?: number; y?: number; w: number; h: number }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      pointerEvents: 'none',
      background: 'repeating-linear-gradient(90deg, rgba(255,122,26,0) 0px, rgba(255,122,26,0) 3px, rgba(255,122,26,0.04) 4px)',
      zIndex: 1,
    }} />
  )
}

interface PxTextProps {
  x: number; y: number; children: React.ReactNode
  color?: string; size?: number; weight?: number
  letterSpacing?: string; shadow?: boolean
  align?: 'left' | 'center' | 'right'; width?: number
  style?: React.CSSProperties
}

function PxText({ x, y, children, color = OF.ink, size = 20, weight = 400, letterSpacing = '0.05em', shadow = false, align = 'left', width, style = {} }: PxTextProps) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width,
      fontFamily: FONT_PIXEL,
      fontSize: size, fontWeight: weight,
      color, letterSpacing,
      textTransform: 'uppercase',
      textAlign: align,
      textShadow: shadow ? `0 0 6px ${color}88` : 'none',
      whiteSpace: 'pre',
      lineHeight: 1,
      ...style,
    }}>{children}</div>
  )
}

function PxBar({ x, y, w, h = 10, progress = 0, color = OF.cyan, bg = OF.bgCard }: {
  x: number; y: number; w: number; h?: number; progress?: number; color?: string; bg?: string
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: bg, border: `1px solid ${color}88`, boxShadow: `0 0 4px ${color}44` }}>
      <div style={{ width: `${progress * 100}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  )
}

function Cursor({ x, y, size = 18, color = OF.orange }: { x: number; y: number; size?: number; color?: string }) {
  const t = useTime()
  const visible = Math.floor(t * 2) % 2 === 0
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: size * 0.55, height: size,
      background: color,
      opacity: visible ? 1 : 0,
      boxShadow: `0 0 6px ${color}`,
    }} />
  )
}

interface Point { x: number; y: number }

function Wire({ from, to, color = OF.cyan, progress = 1, dashed = false, width = 2, flow = null }: {
  from: Point; to: Point
  color?: string; progress?: number; dashed?: boolean; width?: number; flow?: number | null
}) {
  const midX = from.x + (to.x - from.x) * 0.55
  const path = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`
  const totalLen = Math.abs(midX - from.x) + Math.abs(to.y - from.y) + Math.abs(to.x - midX)

  let dotX = from.x, dotY = from.y
  if (flow != null && progress >= 1) {
    let d = flow * totalLen
    const seg1 = Math.abs(midX - from.x)
    const seg2 = Math.abs(to.y - from.y)
    if (d <= seg1) {
      dotX = from.x + Math.sign(midX - from.x) * d; dotY = from.y
    } else if (d <= seg1 + seg2) {
      dotX = midX; dotY = from.y + Math.sign(to.y - from.y) * (d - seg1)
    } else {
      dotX = midX + Math.sign(to.x - midX) * (d - seg1 - seg2); dotY = to.y
    }
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }} width="100%" height="100%">
      <path
        d={path}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={dashed ? '6 4' : String(totalLen)}
        strokeDashoffset={dashed ? 0 : totalLen * (1 - progress)}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
      {flow != null && progress >= 1 && (
        <rect x={dotX - 4} y={dotY - 4} width={8} height={8} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      )}
    </svg>
  )
}

function PluginChip({ x, y, w = 150, h = 44, plugin, lit = false, highlight = false, dim = false }: {
  x: number; y: number; w?: number; h?: number
  plugin: PluginDef; lit?: boolean; highlight?: boolean; dim?: boolean
}) {
  const borderColor = highlight ? OF.cyan : (lit ? plugin.color : OF.frameDim)
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      border: `2px solid ${borderColor}`,
      background: lit ? `${plugin.color}10` : OF.bgCard,
      boxShadow: highlight ? `0 0 12px ${OF.cyan}, inset 0 0 8px ${OF.cyan}44` : (lit ? `inset 0 0 8px ${plugin.color}22` : 'none'),
      fontFamily: FONT_PIXEL, padding: '4px 8px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      opacity: dim ? 0.28 : 1,
    }}>
      <div style={{ fontSize: 18, color: lit ? plugin.color : OF.frameDim, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>
        {plugin.name}
      </div>
      <div style={{ fontSize: 12, color: OF.frameDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2, lineHeight: 1 }}>
        {plugin.kind}
      </div>
    </div>
  )
}

function PortChip({ x, y, w = 170, h = 26, name, lit = false, highlight = false }: {
  x: number; y: number; w?: number; h?: number; name: string; lit?: boolean; highlight?: boolean
}) {
  const borderColor = highlight ? OF.cyan : (lit ? OF.cyan : OF.frameDim)
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      border: `1px dashed ${borderColor}`,
      background: lit ? `${OF.cyan}14` : 'transparent',
      boxShadow: highlight ? `0 0 10px ${OF.cyan}` : 'none',
      fontFamily: FONT_PIXEL, padding: '2px 8px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 16, color: lit ? OF.cyan : OF.cyanDim, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>
        {name}
      </span>
      <span style={{ fontSize: 13, color: lit ? OF.cyan : OF.cyanDim, letterSpacing: '0.1em', lineHeight: 1 }}>
        :PORT
      </span>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell({ children, sceneLabel, sceneNum, totalScenes = 7 }: {
  children: React.ReactNode
  sceneLabel: string
  sceneNum: number
  totalScenes?: number
}) {
  const t = useTime()
  const pulse = Math.floor(t * 2) % 2 === 0
  const mhz = 800 + Math.floor((Math.sin(t * 1.2) + 1) * 40)
  const tickHex = Math.floor(t * 1000).toString(16).toUpperCase().padStart(6, '0')

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: OF.bg }} />
      <Phosphor x={0} y={0} w={1280} h={800} />

      {/* Title bar */}
      <div style={{ position: 'absolute', left: 28, right: 28, top: 18, height: 40, border: `2px solid ${OF.frame}`, display: 'flex', alignItems: 'center', padding: '0 14px', justifyContent: 'space-between', fontFamily: FONT_PIXEL, color: OF.orange }}>
        <span style={{ fontSize: 22, letterSpacing: '0.2em' }}>INKWELL · KERNEL V8 · LIVE DEMO</span>
        <span style={{ fontSize: 18, color: OF.cyan, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, background: OF.cyan, opacity: pulse ? 1 : 0.2, boxShadow: pulse ? `0 0 8px ${OF.cyan}` : 'none' }} />
          LINK · {mhz} MHZ
        </span>
      </div>

      {/* Inner frame */}
      <div style={{ position: 'absolute', left: 28, right: 28, top: 72, bottom: 92, border: `2px solid ${OF.frame}` }}>
        <CornerTick pos="tl" color={OF.frame} />
        <CornerTick pos="tr" color={OF.frame} />
        <CornerTick pos="bl" color={OF.frame} />
        <CornerTick pos="br" color={OF.frame} />
      </div>

      {/* Scene label */}
      <div style={{ position: 'absolute', left: 44, top: 86, fontFamily: FONT_PIXEL, color: OF.orangeBright, fontSize: 20, letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: OF.cyan }}>inkwell://kernel</span>
        <span style={{ color: OF.frameDim }}>·</span>
        <span>{sceneLabel}</span>
      </div>
      <div style={{ position: 'absolute', right: 44, top: 86, fontFamily: FONT_PIXEL, color: OF.cyan, fontSize: 18, letterSpacing: '0.15em' }}>
        {sceneNum.toString().padStart(2, '0')}/{totalScenes.toString().padStart(2, '0')} · 0x{tickHex}
      </div>

      {/* Main content viewport */}
      <div style={{ position: 'absolute', left: 44, top: 118, width: 1192, height: 580, overflow: 'hidden' }}>
        {children}
      </div>

      <BottomStrip />
      <Scanlines x={0} y={0} w={1280} h={800} />
    </>
  )
}

function BottomStrip() {
  const t = useTime()
  const bars = 5
  const rssi = Math.floor((Math.sin(t * 1.7) + 1) * 2.5)
  return (
    <div style={{ position: 'absolute', left: 28, right: 28, bottom: 18, height: 56, border: `2px solid ${OF.frame}`, display: 'flex', alignItems: 'center', padding: '0 18px', justifyContent: 'space-between', fontFamily: FONT_PIXEL, color: OF.orange }}>
      {/* D-pad */}
      <div style={{ position: 'relative', width: 80, height: 40, color: OF.frameDim }}>
        <div style={{ position: 'absolute', left: 28, top: 0,  width: 12, height: 12, border: `2px solid ${OF.frame}` }} />
        <div style={{ position: 'absolute', left: 28, top: 24, width: 12, height: 12, border: `2px solid ${OF.frame}` }} />
        <div style={{ position: 'absolute', left: 4,  top: 12, width: 12, height: 12, border: `2px solid ${OF.frame}` }} />
        <div style={{ position: 'absolute', left: 52, top: 12, width: 12, height: 12, border: `2px solid ${OF.frame}` }} />
        <div style={{ position: 'absolute', left: 28, top: 12, width: 12, height: 12, background: OF.frame }} />
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 16, color: OF.orangeBright, letterSpacing: '0.12em' }}>
        <span>[SPACE] PLAY/PAUSE</span>
        <span style={{ color: OF.frameDim }}>·</span>
        <span>[← →] SEEK</span>
        <span style={{ color: OF.frameDim }}>·</span>
        <span>[0] RESET</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} style={{ width: 6, height: 8 + i * 5, background: i <= rssi ? OF.cyan : `${OF.cyanDim}44`, boxShadow: i <= rssi ? `0 0 4px ${OF.cyan}` : 'none' }} />
        ))}
        <div style={{ marginLeft: 12, width: 40, height: 16, border: `2px solid ${OF.frame}`, display: 'flex', alignItems: 'center', padding: '0 2px' }}>
          <div style={{ flex: 1, height: 8, background: OF.frame }} />
        </div>
      </div>
    </div>
  )
}

// ── Scene 1: Boot (0.0 – 4.0) ─────────────────────────────────────────────────

function SceneBoot() {
  const { localTime } = useSprite()
  const lines = [
    { t: 0.2, text: '> inkwell kernel v8.0.0' },
    { t: 0.5, text: '> loading config: inkwell.config.ts' },
    { t: 0.9, text: '> resolving adapters...' },
    { t: 1.2, text: '> [ok] storage    -> cloudflare.d1' },
    { t: 1.4, text: '> [ok] media      -> cloudflare.r2' },
    { t: 1.6, text: '> [ok] session    -> cloudflare.kv' },
    { t: 1.8, text: '> [ok] graph      -> cloudflare.durable' },
    { t: 2.0, text: '> [ok] agent      -> anthropic.claude-sonnet' },
    { t: 2.3, text: '> kernel ready. tick = 0' },
    { t: 2.6, text: '> awaiting plugin registration...' },
  ]
  const visibleLines = lines.filter(l => localTime >= l.t)
  const logoOpacity = clamp(interpolate([0, 0.4, 3.5, 4], [0, 1, 1, 0])(localTime), 0, 1)

  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 80, opacity: logoOpacity }}>
        <PxText x={0} y={0} size={110} color={OF.orange} weight={400} letterSpacing="0.02em" shadow>INKWELL</PxText>
        <PxText x={0} y={120} size={32} color={OF.cyan} weight={400}>MICROKERNEL · V8</PxText>
        <PxText x={0} y={170} size={20} color={OF.orangeBright} weight={400}>
          ~430 LOC · 14 PORTS · 24 PLUGINS
        </PxText>
        <PxText x={0} y={210} size={20} color={OF.frameDim} weight={400}>
          OPEN SOURCE · MIT · DIGID INC
        </PxText>
      </div>

      <Panel x={620} y={40} w={540} h={480} border={OF.frame} title="BOOT LOG">
        <div style={{ padding: '20px 18px', fontFamily: FONT_PIXEL, fontSize: 19, lineHeight: 1.35, color: OF.ink }}>
          {visibleLines.map((l, i) => (
            <div key={i} style={{
              color: l.text.includes('[ok]') ? OF.green : (l.text.includes('kernel ready') ? OF.cyan : OF.orangeBright),
              letterSpacing: '0.02em',
            }}>{l.text}</div>
          ))}
          {localTime < 3 && <Cursor x={14} y={visibleLines.length * 26 - 6} />}
          {localTime >= 3 && (
            <div style={{ marginTop: 14, color: OF.cyan, fontSize: 21, letterSpacing: '0.1em' }}>
              ▸ SYSTEM READY_
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}

// ── Scene 2: Plugins Load (4.0 – 12.5) ───────────────────────────────────────

function LegendDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT_PIXEL }}>
      <div style={{ width: 18, height: 18, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 18, color: OF.ink, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 16, color, marginLeft: 4 }}>×{count}</span>
    </div>
  )
}

function PluginGrid({ loadedCount, highlightIdx = -1 }: { loadedCount: number; highlightIdx?: number }) {
  const cols = 6, cellW = 170, cellH = 54, gap = 10
  const gridW = cols * cellW + (cols - 1) * gap
  return (
    <div style={{ position: 'relative', width: gridW, height: 4 * cellH + 3 * gap }}>
      {PLUGINS.map((p, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return (
          <PluginChip
            key={p.name}
            x={col * (cellW + gap)}
            y={row * (cellH + gap)}
            w={cellW} h={cellH}
            plugin={p}
            lit={i < loadedCount}
            highlight={i === highlightIdx}
          />
        )
      })}
    </div>
  )
}

function ScenePluginsLoad() {
  const { localTime } = useSprite()
  const loadT = clamp(localTime / 6.5, 0, 1)
  const loadedCount = Math.floor(loadT * (PLUGINS.length + 1))
  const justLoaded = loadedCount - 1

  return (
    <>
      <PxText x={0} y={0} size={28} color={OF.orange}>plugins/</PxText>
      <PxText x={160} y={4} size={22} color={OF.cyan}>{loadedCount}/{PLUGINS.length} REGISTERED</PxText>

      <div style={{ position: 'absolute', left: 0, top: 48 }}>
        <PluginGrid loadedCount={loadedCount} highlightIdx={justLoaded} />
      </div>

      <div style={{ position: 'absolute', right: 0, top: 48, width: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PxText x={0} y={0} size={18} color={OF.orangeBright}>KINDS</PxText>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LegendDot color={OF.orange} label="SURFACE" count={PLUGINS.filter(p => p.kind === 'surface').length} />
          <LegendDot color={OF.cyan}   label="SERVICE" count={PLUGINS.filter(p => p.kind === 'service').length} />
          <LegendDot color={OF.green}  label="AI"      count={PLUGINS.filter(p => p.kind === 'ai').length} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, bottom: 40, width: 1000 }}>
        <PxText x={0} y={-22} size={18} color={OF.cyan}>REGISTERING · /{PLUGINS[justLoaded]?.name ?? 'done'}</PxText>
        <PxBar x={0} y={0} w={1000} h={14} progress={loadT} color={OF.cyan} />
      </div>

      {localTime > 7 && (
        <PxText x={0} y={520} size={22} color={OF.orangeBright}>
          → each plugin declares: routes · widgets · tools · ports · rbac · migrations
        </PxText>
      )}
    </>
  )
}

// ── Scene 3: Ports Bind (12.5 – 20.5) ────────────────────────────────────────

const PORT_BINDINGS: Array<{ plugin: string; port: string }> = [
  { plugin: 'content',      port: 'content' },
  { plugin: 'content',      port: 'storage' },
  { plugin: 'media',        port: 'media' },
  { plugin: 'auth',         port: 'session' },
  { plugin: 'auth',         port: 'auth' },
  { plugin: 'commerce',     port: 'payments' },
  { plugin: 'commerce',     port: 'economy' },
  { plugin: 'mcp',          port: 'agent' },
  { plugin: 'mcp',          port: 'bus' },
  { plugin: 'analytics',    port: 'analytics' },
  { plugin: 'sync',         port: 'bus' },
  { plugin: 'notifications',port: 'notifications' },
  { plugin: 'chat',         port: 'memory' },
  { plugin: 'discovery',    port: 'graph' },
  { plugin: 'seo',          port: 'contentSource' },
]

function ScenePortsBind() {
  const { localTime } = useSprite()
  const shownPlugins = ['content', 'media', 'auth', 'commerce', 'mcp', 'analytics', 'sync', 'chat']
  const bindT = clamp(localTime / 6.5, 0, 1)
  const bindingsVisible = Math.floor(bindT * (PORT_BINDINGS.length + 1))

  const leftX = 40, pluginColW = 170, pluginSpacing = 50
  const rightX = 900, portColW = 220, portH = 28, portSpacing = 10

  const pluginY = (idx: number) => 30 + idx * pluginSpacing
  const portY = (idx: number) => 30 + idx * (portH + portSpacing - 3)

  const getPluginPos = (name: string): Point | null => {
    const idx = shownPlugins.indexOf(name)
    if (idx < 0) return null
    return { x: leftX + pluginColW, y: pluginY(idx) + 22 }
  }
  const getPortPos = (name: string): Point | null => {
    const idx = PORTS.indexOf(name)
    if (idx < 0) return null
    return { x: rightX, y: portY(idx) + portH / 2 }
  }

  const litPlugins = new Set<string>()
  const litPorts = new Set<string>()
  for (let i = 0; i < bindingsVisible; i++) {
    litPlugins.add(PORT_BINDINGS[i].plugin)
    litPorts.add(PORT_BINDINGS[i].port)
  }

  return (
    <>
      <PxText x={leftX} y={0} size={22} color={OF.orange}>PLUGINS</PxText>
      <PxText x={rightX} y={0} size={22} color={OF.cyan}>PORTS ({PORTS.length})</PxText>
      <PxText x={480} y={0} size={22} color={OF.orangeBright}>← KERNEL ROUTES →</PxText>

      {shownPlugins.map((name, i) => {
        const p = PLUGINS.find(x => x.name === name)!
        return <PluginChip key={name} plugin={p} x={leftX} y={pluginY(i)} w={pluginColW} h={44} lit={litPlugins.has(name)} />
      })}

      {PORTS.map((name, i) => (
        <PortChip key={name} name={name} x={rightX} y={portY(i)} w={portColW} h={portH} lit={litPorts.has(name)} />
      ))}

      {/* Kernel block */}
      <div style={{ position: 'absolute', left: 520, top: 140, width: 240, height: 240, border: `2px solid ${OF.frame}`, background: OF.bgCard, boxShadow: `0 0 20px ${OF.frame}33, inset 0 0 20px ${OF.frame}22` }}>
        <div style={{ position: 'absolute', inset: 14, border: `1px dashed ${OF.orange}55` }} />
        <CornerTick pos="tl" color={OF.frame} /><CornerTick pos="tr" color={OF.frame} />
        <CornerTick pos="bl" color={OF.frame} /><CornerTick pos="br" color={OF.frame} />
        <PxText x={0} y={54}  size={26} color={OF.orange} align="center" width={240} style={{ textShadow: `0 0 6px ${OF.orange}` }}>KERNEL</PxText>
        <PxText x={0} y={90}  size={16} color={OF.cyan}   align="center" width={240}>register()</PxText>
        <PxText x={0} y={114} size={16} color={OF.cyan}   align="center" width={240}>resolve()</PxText>
        <PxText x={0} y={138} size={16} color={OF.cyan}   align="center" width={240}>route()</PxText>
        <PxText x={0} y={162} size={16} color={OF.cyan}   align="center" width={240}>dispatch()</PxText>
        <PxText x={0} y={200} size={14} color={OF.frameDim} align="center" width={240}>~430 LOC</PxText>
      </div>

      {PORT_BINDINGS.slice(0, bindingsVisible).map((b, i) => {
        const pp = getPluginPos(b.plugin)
        const portp = getPortPos(b.port)
        if (!pp || !portp) return null
        const kernelLeft  = { x: 520, y: 180 + (i % 5) * 40 }
        const kernelRight = { x: 760, y: 180 + (i % 5) * 40 }
        const isLatest = i === bindingsVisible - 1
        const color = isLatest ? OF.cyanBright : `${OF.cyanDim}aa`
        return (
          <React.Fragment key={i}>
            <Wire from={pp} to={kernelLeft} color={color} width={isLatest ? 2.5 : 1.5} />
            <Wire from={kernelRight} to={portp} color={color} width={isLatest ? 2.5 : 1.5} />
          </React.Fragment>
        )
      })}

      <div style={{ position: 'absolute', left: leftX, top: 490, width: 1100, fontFamily: FONT_MONO, fontSize: 17, color: OF.orangeBright, letterSpacing: '0.04em' }}>
        {bindingsVisible > 0 && (() => {
          const b = PORT_BINDINGS[bindingsVisible - 1]
          return <>kernel.bind(<span style={{ color: OF.orange }}>"{b.plugin}"</span>, <span style={{ color: OF.cyan }}>ports.{b.port}</span>) <span style={{ color: OF.green }}>→ OK</span></>
        })()}
      </div>
    </>
  )
}

// ── Scene 4: HTTP Route (20.5 – 28.5) ────────────────────────────────────────

function FlowNode({ x, y, w, h, label, sub, color = OF.orange, lit = false, active = false, dashed = false }: {
  x: number; y: number; w: number; h: number
  label: string; sub: string; color?: string
  lit?: boolean; active?: boolean; dashed?: boolean
}) {
  const border = lit ? color : `${color}55`
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      border: `2px ${dashed ? 'dashed' : 'solid'} ${border}`,
      background: lit ? `${color}18` : OF.bgCard,
      boxShadow: active ? `0 0 18px ${color}, inset 0 0 10px ${color}55` : (lit ? `inset 0 0 10px ${color}22` : 'none'),
      fontFamily: FONT_PIXEL,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    }}>
      <div style={{ fontSize: 18, color: lit ? color : `${color}88`, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: OF.frameDim, letterSpacing: '0.06em', marginTop: 3, lineHeight: 1 }}>{sub}</div>
    </div>
  )
}

function SceneHttpRoute() {
  const { localTime } = useSprite()
  const t = localTime

  const reqProg      = clamp(t / 1.0, 0, 1)
  const routeProg    = clamp((t - 1.0) / 1.0, 0, 1)
  const storageProg  = clamp((t - 2.0) / 1.5, 0, 1)
  const returnProg   = clamp((t - 3.5) / 1.5, 0, 1)
  const responseProg = clamp((t - 5.0) / 2.0, 0, 1)

  const req    = { x: 60,   y: 260 }
  const kernel = { x: 400,  y: 260 }
  const plugin = { x: 720,  y: 200 }
  const port   = { x: 1020, y: 200 }
  const db     = { x: 1020, y: 340 }
  const boxW = 160, boxH = 60

  return (
    <>
      <PxText x={0} y={0} size={24} color={OF.orange}>REQUEST FLOW</PxText>
      <PxText x={0} y={30} size={18} color={OF.orangeBright}>GET /api/articles/hello-inkwell</PxText>

      <div style={{
        position: 'absolute',
        left: req.x + (reqProg < 1 ? -100 * (1 - reqProg) : 0),
        top: req.y - 22,
        width: 180, height: 44,
        opacity: clamp(reqProg * 2, 0, 1),
        border: `2px solid ${OF.green}`,
        background: OF.bgCard,
        padding: '4px 10px',
        fontFamily: FONT_PIXEL, fontSize: 16,
        boxShadow: `0 0 10px ${OF.green}66`,
      }}>
        <div style={{ color: OF.green, letterSpacing: '0.08em' }}>GET /articles</div>
        <div style={{ color: OF.orangeBright, fontSize: 14, marginTop: 2 }}>sessionId: u_4f2a</div>
      </div>

      <FlowNode x={kernel.x - boxW/2} y={kernel.y - boxH/2} w={boxW} h={boxH} label="KERNEL" sub="route() dispatch()" lit={reqProg > 0.5} active={routeProg > 0 && routeProg < 1} color={OF.frame} />
      <FlowNode x={plugin.x - boxW/2} y={plugin.y - boxH/2} w={boxW} h={boxH} label="content" sub="plugin · surface" lit={routeProg > 0.5} active={storageProg > 0 && storageProg < 1} color={OF.orange} />
      <FlowNode x={port.x - 90} y={port.y - 24} w={180} h={48} label="ports.storage" sub="D1 adapter" lit={storageProg > 0.3} active={returnProg > 0 && returnProg < 1} color={OF.cyan} dashed />
      <FlowNode x={db.x - 90} y={db.y - 24} w={180} h={48} label="cloudflare.d1" sub="articles" lit={storageProg > 0.6} color={OF.cyanDim} dashed />

      <Wire from={{ x: req.x + 180, y: req.y }} to={kernel} color={OF.green} progress={reqProg} flow={reqProg < 1 ? reqProg : (returnProg > 0 ? null : (responseProg > 0 ? 1 - responseProg : null))} />
      <Wire from={{ x: kernel.x + boxW/2, y: kernel.y }} to={{ x: plugin.x - boxW/2, y: plugin.y }} color={OF.orange} progress={routeProg} />
      <Wire from={{ x: plugin.x + boxW/2, y: plugin.y }} to={{ x: port.x - 90, y: port.y }} color={OF.cyan} progress={storageProg} />
      <Wire from={{ x: port.x, y: port.y + 24 }} to={{ x: db.x, y: db.y - 24 }} color={OF.cyanDim} progress={storageProg} />

      {storageProg > 0.3 && (
        <div style={{ position: 'absolute', left: port.x - 110, top: port.y - 90, width: 220, fontFamily: FONT_MONO, fontSize: 14, color: OF.cyan, background: OF.bgCard, border: `1px solid ${OF.cyan}55`, padding: '6px 8px', opacity: storageProg < 0.7 ? (storageProg - 0.3) / 0.4 : Math.max(0, 1 - (returnProg - 0.5) * 2) }}>
          SELECT * FROM articles<br/>WHERE slug = 'hello-<br/>inkwell' LIMIT 1;
        </div>
      )}

      {returnProg > 0.4 && responseProg < 0.8 && (
        <div style={{ position: 'absolute', left: 280, top: 380, width: 620, fontFamily: FONT_MONO, fontSize: 14, color: OF.green, background: OF.bgCard, border: `1px solid ${OF.green}55`, padding: '10px 12px', lineHeight: 1.3, opacity: clamp(returnProg - 0.4, 0, 1) }}>
          <span style={{ color: OF.orangeBright }}>← 200 OK</span><br/>
          {'{ "title": "Hello, Inkwell", "author": "agent", "body": "..." }'}
        </div>
      )}

      <PxText x={0} y={500} size={20} color={OF.orangeBright}>
        → ROUTE · DISPATCH · PORT CALL · RESPONSE · ALL IN ~2MS
      </PxText>
    </>
  )
}

// ── Scene 5: Event Bus (28.5 – 34.5) ─────────────────────────────────────────

function SceneEventBus() {
  const { localTime } = useSprite()
  const t = localTime

  const emitProg  = clamp(t / 1.0, 0, 1)
  const busProg   = clamp((t - 1.0) / 1.0, 0, 1)
  const fanProg   = clamp((t - 2.0) / 1.5, 0, 1)
  const reactProg = clamp((t - 3.5) / 2.0, 0, 1)

  const emitter = { x: 120, y: 280 }
  const bus     = { x: 540, y: 280 }
  const listeners = [
    { name: 'analytics',     action: 'track(page.published)', y: 140, color: OF.cyan },
    { name: 'seo',           action: 'rebuild sitemap',       y: 280, color: OF.cyan },
    { name: 'notifications', action: 'send to 134 subs',      y: 420, color: OF.cyan },
  ]

  return (
    <>
      <PxText x={0} y={0} size={24} color={OF.orange}>EVENT BUS · FAN-OUT</PxText>
      <PxText x={0} y={30} size={18} color={OF.orangeBright}>bus.emit("content.published", {'{'}'id: 142{'}'})</PxText>

      <FlowNode x={emitter.x - 90} y={emitter.y - 30} w={180} h={60} label="content" sub="emits event" color={OF.orange} lit={emitProg > 0.3} active={emitProg > 0 && emitProg < 1} />

      <div style={{
        position: 'absolute',
        left: bus.x - 100, top: bus.y - 140,
        width: 200, height: 280,
        border: `2px solid ${OF.frame}`,
        background: OF.bgCard,
        boxShadow: busProg > 0.2 ? `0 0 24px ${OF.frame}55, inset 0 0 24px ${OF.orange}22` : `inset 0 0 12px ${OF.frame}22`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_PIXEL,
      }}>
        <CornerTick pos="tl" color={OF.frame} /><CornerTick pos="tr" color={OF.frame} />
        <CornerTick pos="bl" color={OF.frame} /><CornerTick pos="br" color={OF.frame} />
        <div style={{ fontSize: 26, color: OF.orange, letterSpacing: '0.15em', textShadow: busProg > 0.2 ? `0 0 10px ${OF.orange}` : 'none' }}>BUS</div>
        <div style={{ fontSize: 14, color: OF.cyan, marginTop: 6, letterSpacing: '0.1em' }}>ports.bus</div>
        <div style={{ fontSize: 13, color: OF.frameDim, marginTop: 24, letterSpacing: '0.08em', textAlign: 'center', padding: '0 10px' }}>
          subscribers:{'\n'}<span style={{ color: OF.cyan }}>3 listeners</span>
        </div>
      </div>

      <Wire from={{ x: emitter.x + 90, y: emitter.y }} to={{ x: bus.x - 100, y: bus.y }} color={OF.orange} progress={emitProg} flow={emitProg >= 1 && busProg < 1 ? busProg : null} />

      {listeners.map((l, i) => (
        <Wire key={l.name} from={{ x: bus.x + 100, y: bus.y }} to={{ x: 820, y: l.y }} color={l.color} progress={fanProg} flow={fanProg >= 1 && reactProg < 1 ? reactProg : null} width={2} />
      ))}

      {listeners.map((l, i) => {
        const p = PLUGINS.find(x => x.name === l.name)
        return (
          <React.Fragment key={l.name}>
            <FlowNode x={820} y={l.y - 24} w={180} h={48} label={l.name} sub={l.action} color={p?.color ?? OF.cyan} lit={fanProg > 0.5} active={reactProg > i * 0.2 && reactProg < i * 0.2 + 0.7} />
            {reactProg > i * 0.2 + 0.3 && (
              <div style={{ position: 'absolute', left: 1010, top: l.y - 12, fontFamily: FONT_PIXEL, fontSize: 18, color: OF.green, letterSpacing: '0.1em', opacity: clamp((reactProg - i * 0.2 - 0.3) * 3, 0, 1) }}>
                ✓ DONE
              </div>
            )}
          </React.Fragment>
        )
      })}

      <PxText x={0} y={500} size={20} color={OF.orangeBright}>
        → EVENTS ARE TYPED · ASYNC · OBSERVABLE · PLUGINS STAY DECOUPLED
      </PxText>
    </>
  )
}

// ── Scene 6: MCP Call (34.5 – 42.0) ──────────────────────────────────────────

function SceneMcpCall() {
  const { localTime } = useSprite()
  const t = localTime

  const phase = {
    call:   clamp(t / 1.0, 0, 1),
    rbac:   clamp((t - 1.0) / 1.2, 0, 1),
    tool:   clamp((t - 2.2) / 1.3, 0, 1),
    result: clamp((t - 3.5) / 1.5, 0, 1),
    reply:  clamp((t - 5.0) / 1.8, 0, 1),
  }

  return (
    <>
      <PxText x={0} y={0} size={24} color={OF.green}>MCP · AGENT TOOL CALL</PxText>
      <PxText x={0} y={30} size={18} color={OF.orangeBright}>claude → tool("get_seo_data", {'{'}'domain: "inkwell.dev"{'}'})</PxText>

      <FlowNode x={30} y={200} w={160} h={70} label="CLAUDE" sub="mcp.agent" color={OF.green} lit={phase.call > 0.2} active={phase.call < 1} />
      <FlowNode x={260} y={200} w={160} h={70} label="mcp plugin" sub="tool registry · 16" color={OF.green} lit={phase.call > 0.6} active={phase.rbac > 0 && phase.rbac < 1} />

      <div style={{
        position: 'absolute', left: 490, top: 200, width: 140, height: 70,
        border: `2px dashed ${phase.rbac > 0.5 ? OF.yellow : OF.frameDim}`,
        background: OF.bgCard,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        fontFamily: FONT_PIXEL,
        boxShadow: phase.rbac > 0.5 && phase.rbac < 1 ? `0 0 16px ${OF.yellow}, inset 0 0 10px ${OF.yellow}44` : 'none',
      }}>
        <div style={{ fontSize: 20, color: phase.rbac > 0.5 ? OF.yellow : OF.frameDim, letterSpacing: '0.1em' }}>RBAC</div>
        <div style={{ fontSize: 12, color: OF.frameDim, letterSpacing: '0.06em', marginTop: 4 }}>role: owner</div>
        {phase.rbac > 0.8 && <div style={{ fontSize: 14, color: OF.green, letterSpacing: '0.1em', marginTop: 4 }}>✓ ALLOW</div>}
      </div>

      <FlowNode x={690} y={200} w={180} h={70} label="seo plugin" sub="get_seo_data()" color={OF.cyan} lit={phase.tool > 0.3} active={phase.tool > 0 && phase.tool < 1} />
      <FlowNode x={930} y={200} w={200} h={70} label="analyticsPort" sub="GA4 + GSC" color={OF.cyan} lit={phase.tool > 0.6} dashed />

      <Wire from={{ x: 190, y: 235 }} to={{ x: 260, y: 235 }} color={OF.green} progress={phase.call} flow={phase.call >= 1 && phase.rbac < 1 ? phase.rbac : null} />
      <Wire from={{ x: 420, y: 235 }} to={{ x: 490, y: 235 }} color={OF.yellow} progress={phase.rbac} />
      <Wire from={{ x: 630, y: 235 }} to={{ x: 690, y: 235 }} color={OF.yellow} progress={phase.tool > 0 ? 1 : 0} flow={phase.rbac >= 1 && phase.tool < 1 ? phase.tool : null} />
      <Wire from={{ x: 870, y: 235 }} to={{ x: 930, y: 235 }} color={OF.cyan} progress={phase.tool} />

      {phase.reply > 0 && (
        <Wire from={{ x: 930, y: 310 }} to={{ x: 110, y: 310 }} color={OF.green} progress={1} flow={phase.reply} />
      )}

      <div style={{ position: 'absolute', left: 30, top: 310, width: 380, fontFamily: FONT_MONO, fontSize: 15, color: OF.green, background: OF.bgCard, border: `1px solid ${OF.green}44`, padding: '8px 10px', opacity: phase.call > 0.5 ? 1 : 0 }}>
        <div style={{ color: OF.orangeBright, fontSize: 13, letterSpacing: '0.1em', marginBottom: 4 }}>REQUEST</div>
        tool: <span style={{ color: OF.cyan }}>"get_seo_data"</span><br/>
        args: {'{'}<br/>
        &nbsp;&nbsp;domain: <span style={{ color: OF.cyan }}>"inkwell.dev"</span>,<br/>
        &nbsp;&nbsp;range: <span style={{ color: OF.cyan }}>"7d"</span><br/>
        {'}'}
      </div>

      {phase.result > 0.3 && (
        <div style={{ position: 'absolute', left: 690, top: 310, width: 440, fontFamily: FONT_MONO, fontSize: 14, color: OF.cyan, background: OF.bgCard, border: `1px solid ${OF.cyan}44`, padding: '8px 10px', opacity: clamp(phase.result * 2, 0, 1), lineHeight: 1.4 }}>
          <div style={{ color: OF.orangeBright, fontSize: 13, letterSpacing: '0.1em', marginBottom: 4 }}>RESPONSE (JSON)</div>
          {'{'}<br/>
          &nbsp;&nbsp;impressions: <span style={{ color: OF.green }}>12,847</span>,<br/>
          &nbsp;&nbsp;clicks: <span style={{ color: OF.green }}>934</span>,<br/>
          &nbsp;&nbsp;avg_position: <span style={{ color: OF.green }}>8.4</span>,<br/>
          &nbsp;&nbsp;top_queries: <span style={{ color: OF.green }}>[ ... ]</span><br/>
          {'}'}
        </div>
      )}

      <PxText x={0} y={500} size={20} color={OF.orangeBright}>
        → 16 MCP TOOLS · RBAC-GATED · TYPED · AGENT-OPERATED
      </PxText>
    </>
  )
}

// ── Scene 7: Hot-Swap (42.0 – 48.0) ──────────────────────────────────────────

function SceneHotSwap() {
  const { localTime } = useSprite()
  const t = localTime

  const editT    = clamp(t / 1.5, 0, 1)
  const applyT   = clamp((t - 1.5) / 1.0, 0, 1)
  const swapT    = clamp((t - 2.5) / 1.5, 0, 1)
  const confirmT = clamp((t - 4.0) / 1.5, 0, 1)

  return (
    <>
      <PxText x={0} y={0} size={24} color={OF.orange}>HOT-SWAP · ADAPTER REBIND</PxText>
      <PxText x={0} y={30} size={18} color={OF.orangeBright}>edit inkwell.config.ts · save · kernel rebinds live</PxText>

      {/* Config file */}
      <div style={{ position: 'absolute', left: 20, top: 80, width: 560, height: 400, background: OF.bgCard, border: `2px solid ${OF.frame}`, fontFamily: FONT_MONO, fontSize: 16, lineHeight: 1.5, padding: '20px 22px', color: OF.ink }}>
        <CornerTick pos="tl" color={OF.frame} /><CornerTick pos="tr" color={OF.frame} />
        <CornerTick pos="bl" color={OF.frame} /><CornerTick pos="br" color={OF.frame} />
        <div style={{ color: OF.cyan, fontSize: 14, letterSpacing: '0.15em', marginBottom: 12 }}>/ INKWELL.CONFIG.TS</div>
        <div><span style={{ color: OF.frameDim }}>1</span>&nbsp;&nbsp;export default {'{'}</div>
        <div><span style={{ color: OF.frameDim }}>2</span>&nbsp;&nbsp;&nbsp;&nbsp;plugins: [<span style={{ color: OF.orange }}>"content"</span>, <span style={{ color: OF.orange }}>"commerce"</span>, ...],</div>
        <div><span style={{ color: OF.frameDim }}>3</span>&nbsp;&nbsp;&nbsp;&nbsp;adapters: {'{'}</div>
        <div>
          <span style={{ color: OF.frameDim }}>4</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;storage:&nbsp;
          <span style={{ color: editT > 0.4 ? OF.red : OF.cyan, textDecoration: editT > 0.5 ? 'line-through' : 'none', opacity: editT > 0.8 ? 0.3 : 1 }}>"cloudflare.d1"</span>
          {editT > 0.4 && (
            <span style={{ color: OF.green, marginLeft: 6, opacity: clamp((editT - 0.4) * 3, 0, 1) }}>
              "postgres"
            </span>
          )}
          ,
        </div>
        <div><span style={{ color: OF.frameDim }}>5</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;media: <span style={{ color: OF.cyan }}>"cloudflare.r2"</span>,</div>
        <div><span style={{ color: OF.frameDim }}>6</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;session: <span style={{ color: OF.cyan }}>"cloudflare.kv"</span>,</div>
        <div><span style={{ color: OF.frameDim }}>7</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;agent: <span style={{ color: OF.cyan }}>"anthropic.sonnet"</span>,</div>
        <div><span style={{ color: OF.frameDim }}>8</span>&nbsp;&nbsp;&nbsp;&nbsp;{'}'},</div>
        <div><span style={{ color: OF.frameDim }}>9</span>&nbsp;&nbsp;{'}'}</div>
        {applyT > 0 && <div style={{ marginTop: 18, color: OF.yellow, fontSize: 15, letterSpacing: '0.1em', opacity: applyT }}>&gt; saved. kernel reloading adapter...</div>}
        {confirmT > 0.1 && <div style={{ marginTop: 4, color: OF.green, fontSize: 15, letterSpacing: '0.1em', opacity: confirmT }}>&gt; [ok] ports.storage → postgres (rebind &lt;12ms)</div>}
      </div>

      {/* Adapter swap visual */}
      <div style={{ position: 'absolute', right: 20, top: 80, width: 500, height: 400 }}>
        <div style={{ position: 'absolute', left: 0, top: 160, width: 200, height: 80, border: `2px solid ${OF.cyan}`, background: OF.bgCard, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: FONT_PIXEL, boxShadow: `inset 0 0 12px ${OF.cyan}22` }}>
          <CornerTick pos="tl" color={OF.cyan} /><CornerTick pos="tr" color={OF.cyan} />
          <CornerTick pos="bl" color={OF.cyan} /><CornerTick pos="br" color={OF.cyan} />
          <div style={{ fontSize: 22, color: OF.cyan, letterSpacing: '0.1em' }}>ports.storage</div>
          <div style={{ fontSize: 13, color: OF.cyanDim, marginTop: 6, letterSpacing: '0.08em' }}>CONTRACT · STABLE</div>
        </div>

        <div style={{ position: 'absolute', left: 300, top: 70, width: 180, height: 70, border: `2px solid ${OF.orange}`, background: OF.bgCard, fontFamily: FONT_PIXEL, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: swapT < 0.7 ? 1 - swapT : 0.15, transform: `translateX(${swapT * 40}px)`, boxShadow: swapT < 0.5 ? `0 0 10px ${OF.orange}44` : 'none' }}>
          <div style={{ fontSize: 18, color: OF.orange }}>cloudflare.d1</div>
          <div style={{ fontSize: 12, color: OF.frameDim, marginTop: 4 }}>{swapT > 0.3 ? 'DISCONNECTED' : 'ACTIVE'}</div>
        </div>

        <div style={{ position: 'absolute', left: 300, top: 260, width: 180, height: 70, border: `2px solid ${OF.green}`, background: OF.bgCard, fontFamily: FONT_PIXEL, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: clamp((swapT - 0.2) * 2, 0, 1), transform: `translateX(${(1 - clamp(swapT * 1.5, 0, 1)) * -60}px)`, boxShadow: swapT > 0.6 ? `0 0 14px ${OF.green}77` : 'none' }}>
          <div style={{ fontSize: 18, color: OF.green }}>postgres</div>
          <div style={{ fontSize: 12, color: OF.frameDim, marginTop: 4 }}>{swapT > 0.6 ? 'BOUND' : 'CONNECTING...'}</div>
        </div>

        {swapT < 0.9 && (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="100%" height="100%">
            <line x1={200} y1={200} x2={300} y2={105} stroke={OF.orange} strokeWidth={2} strokeDasharray="4 4" opacity={1 - swapT} />
          </svg>
        )}
        {swapT > 0.2 && (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="100%" height="100%">
            <line x1={200} y1={200} x2={300} y2={295} stroke={OF.green} strokeWidth={2.5} opacity={clamp((swapT - 0.2) * 1.5, 0, 1)} style={{ filter: `drop-shadow(0 0 4px ${OF.green})` }} />
          </svg>
        )}

        {confirmT > 0.3 && (
          <div style={{ position: 'absolute', left: 0, top: 360, width: '100%', textAlign: 'center', fontFamily: FONT_PIXEL, fontSize: 20, color: OF.green, letterSpacing: '0.15em', opacity: confirmT }}>
            ✓ PLUGINS UNAFFECTED
          </div>
        )}
      </div>

      <PxText x={0} y={500} size={20} color={OF.orangeBright}>
        → PORTS ARE CONTRACTS · ADAPTERS ARE DETAILS · SWAP WITHOUT REWRITES
      </PxText>
    </>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

function sceneFor(time: number): { label: string; num: number } {
  if (time < 4.0)  return { label: 'BOOT',          num: 1 }
  if (time < 12.5) return { label: 'PLUGINS · LOAD',num: 2 }
  if (time < 20.5) return { label: 'PORTS · BIND',  num: 3 }
  if (time < 28.5) return { label: 'ROUTE · HTTP',  num: 4 }
  if (time < 34.5) return { label: 'BUS · FANOUT',  num: 5 }
  if (time < 42.0) return { label: 'MCP · TOOL',    num: 6 }
  return                 { label: 'CONFIG · SWAP',  num: 7 }
}

function KernelAnimationInner() {
  const time = useTime()
  const scene = sceneFor(time)

  return (
    <Shell sceneLabel={scene.label} sceneNum={scene.num}>
      <Sprite start={0}    end={4.0}>  <SceneBoot /></Sprite>
      <Sprite start={4.0}  end={12.5}> <ScenePluginsLoad /></Sprite>
      <Sprite start={12.5} end={20.5}> <ScenePortsBind /></Sprite>
      <Sprite start={20.5} end={28.5}> <SceneHttpRoute /></Sprite>
      <Sprite start={28.5} end={34.5}> <SceneEventBus /></Sprite>
      <Sprite start={34.5} end={42.0}> <SceneMcpCall /></Sprite>
      <Sprite start={42.0} end={48.0}> <SceneHotSwap /></Sprite>
    </Shell>
  )
}

export function KernelAnimation({ height = '100%' }: { height?: string | number }) {
  return (
    <div style={{ width: '100%', height, background: OF.bg }}>
      <Stage
        width={1280}
        height={800}
        duration={48}
        background={OF.bg}
        loop={true}
        autoplay={true}
        showControls={true}
        persistKey="inkwell-kernel-anim"
      >
        <KernelAnimationInner />
      </Stage>
    </div>
  )
}
