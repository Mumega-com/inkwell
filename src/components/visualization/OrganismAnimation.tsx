/**
 * Inkwell Organism Animation
 * 7 scenes, 48 seconds, CRT retro aesthetic.
 *
 * Story: A business gets onboarded → agents deploy → content publishes →
 *        leads land → economy ticks → memory learns → organism loops.
 */

'use client'

import React from 'react'
import { Stage, Sprite, useTime, useTimeline, animate, Easing } from '../../lib/animation.tsx'

// ── Design tokens ─────────────────────────────────────────────────────────────

const OF = {
  bg:      '#060810',
  frame:   '#D4A017',   // gold primary
  cyan:    '#06B6D4',   // cyan secondary
  green:   '#10B981',   // accent / done
  red:     '#EF4444',   // alert
  dim:     'rgba(212,160,23,0.35)',
  dimC:    'rgba(6,182,212,0.35)',
  glass:   'rgba(6,8,16,0.92)',
}

const FONT = "'VT323', 'Share Tech Mono', monospace"

// ── Scene labels ──────────────────────────────────────────────────────────────

const SCENES = [
  { start: 0,  end: 7,  label: 'INTAKE',   sub: 'business_intake' },
  { start: 7,  end: 15, label: 'AGENTS',   sub: 'squad.provision' },
  { start: 15, end: 23, label: 'CONTENT',  sub: 'content.publish' },
  { start: 23, end: 31, label: 'LEADS',    sub: 'crm.capture' },
  { start: 31, end: 39, label: 'ECONOMY',  sub: 'economy.ledger' },
  { start: 39, end: 46, label: 'MEMORY',   sub: 'mirror.recall' },
  { start: 46, end: 48, label: 'ORGANISM', sub: 'loop.active' },
]

// ── Shared atoms ──────────────────────────────────────────────────────────────

function PxText({ x, y, text, size = 16, color = OF.frame, opacity = 1, align = 'left' as 'left' | 'center' | 'right' }: {
  x: number; y: number; text: string; size?: number; color?: string; opacity?: number; align?: 'left' | 'center' | 'right'
}) {
  return (
    <text
      x={x} y={y}
      fontFamily={FONT}
      fontSize={size}
      fill={color}
      opacity={opacity}
      textAnchor={align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}
      dominantBaseline="auto"
    >{text}</text>
  )
}

function Panel({ x, y, w, h, color = OF.frame, opacity = 1, fill = 'none' }: {
  x: number; y: number; w: number; h: number; color?: string; opacity?: number; fill?: string
}) {
  return <rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={1} fill={fill} opacity={opacity} rx={2} />
}

function CornerTick({ x, y, size = 8, color = OF.frame, flip = false }: {
  x: number; y: number; size?: number; color?: string; flip?: boolean
}) {
  const sx = flip ? -1 : 1
  const sy = flip ? -1 : 1
  return (
    <g transform={`translate(${x},${y}) scale(${sx},${sy})`}>
      <line x1={0} y1={0} x2={size} y2={0} stroke={color} strokeWidth={1} />
      <line x1={0} y1={0} x2={0} y2={size} stroke={color} strokeWidth={1} />
    </g>
  )
}

function Scanlines({ width = 1280, height = 720 }: { width?: number; height?: number }) {
  return (
    <rect x={0} y={0} width={width} height={height}
      fill="url(#scanlines)" opacity={0.07} style={{ pointerEvents: 'none' }} />
  )
}

function Phosphor({ width = 1280, height = 720 }: { width?: number; height?: number }) {
  return (
    <rect x={0} y={0} width={width} height={height}
      fill="url(#phosphor)" opacity={0.04} style={{ pointerEvents: 'none' }} />
  )
}

function Cursor({ x, y, color = OF.frame, visible = true }: { x: number; y: number; color?: string; visible?: boolean }) {
  const t = useTime()
  const blink = Math.floor(t * 2) % 2 === 0
  if (!visible || !blink) return null
  return <rect x={x} y={y} width={8} height={2} fill={color} />
}

function StatusDot({ x, y, color, label, size = 6 }: { x: number; y: number; color: string; label: string; size?: number }) {
  return (
    <g>
      <circle cx={x + size / 2} cy={y} r={size / 2} fill={color} />
      <PxText x={x + size + 6} y={y + 4} text={label} size={13} color={color} />
    </g>
  )
}

function ProgressBar({ x, y, w, h, progress, color = OF.green, bgColor = OF.dimC }: {
  x: number; y: number; w: number; h: number; progress: number; color?: string; bgColor?: string
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={bgColor} rx={1} />
      <rect x={x} y={y} width={w * Math.min(1, Math.max(0, progress))} height={h} fill={color} rx={1} />
    </g>
  )
}

// ── Scene 1: Intake (0–7s) ────────────────────────────────────────────────────

const INTAKE_FIELDS = [
  { label: 'name',    value: 'Acme Corp',                  t: 0.5 },
  { label: 'industry',value: 'SaaS / Software',            t: 1.2 },
  { label: 'desc',    value: 'B2B workflow automation',    t: 2.0 },
  { label: 'goals',   value: 'MRR growth, SEO dominance', t: 2.8 },
  { label: 'audience',value: 'Ops teams at 10-200 people', t: 3.5 },
  { label: 'voice',   value: 'direct, no jargon',          t: 4.2 },
]

const WIKI_PAGES = ['overview', 'services', 'audience', 'brand', 'goals', 'strategy']

function SceneIntake() {
  const t = useTime()
  return (
    <Sprite start={0} end={7}>
      <PxText x={80} y={130} text="$ business_intake --client acme-corp" size={17} color={OF.cyan} />
      <PxText x={80} y={155} text="Connecting to Inkwell Worker..." size={15} color={OF.dim} />
      <PxText x={80} y={175} text={t > 1.0 ? '✓ Connected. Ingesting profile.' : ''} size={15} color={OF.green} />

      {/* Field list */}
      {INTAKE_FIELDS.map((f, i) => t > f.t && (
        <g key={f.label}>
          <PxText x={100} y={210 + i * 26} text={`  ${f.label}:`} size={15} color={OF.dim} />
          <PxText x={240} y={210 + i * 26} text={`"${f.value}"`} size={15} color={OF.frame} />
        </g>
      ))}

      {/* Wiki pages appearing */}
      {t > 4.8 && (
        <g>
          <PxText x={80} y={388} text="Writing wiki pages:" size={15} color={OF.cyan} />
          {WIKI_PAGES.map((p, i) => t > 4.8 + i * 0.32 && (
            <PxText key={p} x={100 + i * 130} y={412} text={`[${p}]`} size={14} color={OF.green} />
          ))}
        </g>
      )}

      {t > 6.8 && <PxText x={80} y={445} text="✓ 7 wiki pages created. CRM contact registered." size={15} color={OF.green} />}
    </Sprite>
  )
}

// ── Scene 2: Agents Deploy (7–15s) ────────────────────────────────────────────

const AGENTS = [
  { name: 'content-agent', role: 'content',  color: OF.cyan,  row: 0 },
  { name: 'seo-agent',     role: 'seo',      color: OF.frame, row: 1 },
  { name: 'crm-agent',     role: 'outreach', color: OF.green, row: 2 },
  { name: 'ops-agent',     role: 'ops',      color: OF.dim,   row: 3 },
]

function SceneAgents() {
  const t = useTime()
  const lt = t - 7
  return (
    <Sprite start={7} end={15}>
      <PxText x={80} y={130} text="$ squad.provision --client acme-corp" size={17} color={OF.cyan} />

      <PxText x={80} y={165} text="SOS Bus:" size={15} color={OF.dim} />
      <PxText x={160} y={165} text={lt > 0.5 ? 'CONNECTED' : 'connecting...'} size={15} color={lt > 0.5 ? OF.green : OF.frame} />

      {/* Bus lines */}
      {lt > 0.8 && (
        <g>
          <line x1={200} y1={195} x2={200} y2={440} stroke={OF.dim} strokeWidth={1} strokeDasharray="4,4" />
          <PxText x={210} y={195} text="BUS" size={13} color={OF.dim} />
        </g>
      )}

      {/* Agent rows */}
      {AGENTS.map((ag, i) => lt > 1.0 + i * 0.9 && (
        <g key={ag.name}>
          <Panel x={240} y={200 + i * 56} w={560} h={44} color={ag.color} opacity={0.7} />
          <PxText x={256} y={225 + i * 56} text={`[${ag.name}]`} size={16} color={ag.color} />
          <PxText x={460} y={225 + i * 56} text={`role: ${ag.role}`} size={14} color={OF.dim} />

          {/* Connection wire from bus */}
          <line x1={200} y1={222 + i * 56} x2={240} y2={222 + i * 56} stroke={ag.color} strokeWidth={1} />
          <circle cx={200} cy={222 + i * 56} r={3} fill={ag.color} />

          {/* Status */}
          {lt > 1.6 + i * 0.9 && (
            <PxText x={750} y={225 + i * 56} text="ACTIVE" size={14} color={OF.green} />
          )}
        </g>
      ))}

      {lt > 5.5 && (
        <PxText x={80} y={460} text={`✓ 4 agents active. Tasks queued. Squad online.`} size={15} color={OF.green} />
      )}
    </Sprite>
  )
}

// ── Scene 3: Content Publishes (15–23s) ───────────────────────────────────────

const PAGES = [
  'best-workflow-automation-toronto',
  'best-workflow-automation-vancouver',
  'acme-corp-services',
  'workflow-automation-guide-2026',
  'top-10-ops-tools',
  'acme-corp-vs-competitors',
]

function SceneContent() {
  const t = useTime()
  const lt = t - 15
  return (
    <Sprite start={15} end={23}>
      <PxText x={80} y={130} text="$ content_strategy --run && publish" size={17} color={OF.cyan} />

      {/* Strategy summary */}
      {lt > 0.4 && <PxText x={80} y={162} text="Strategy: 50 SEO pages · 12 blog posts · 4 landing pages" size={15} color={OF.frame} />}
      {lt > 1.0 && <PxText x={80} y={185} text="Target KWs: workflow automation, ops tools, b2b saas" size={14} color={OF.dim} />}

      {/* Pages publishing */}
      {lt > 1.6 && (
        <g>
          <PxText x={80} y={220} text="Publishing:" size={15} color={OF.cyan} />
          {PAGES.map((p, i) => lt > 2.0 + i * 0.7 && (
            <g key={p}>
              <PxText x={100} y={244 + i * 26} text={`/`} size={14} color={OF.dim} />
              <PxText x={115} y={244 + i * 26} text={p} size={14} color={OF.frame} />
              {lt > 2.4 + i * 0.7 && (
                <PxText x={680} y={244 + i * 26} text="→ CF Pages" size={13} color={OF.green} />
              )}
            </g>
          ))}
        </g>
      )}

      {/* Deploy progress */}
      {lt > 5.5 && (
        <g>
          <PxText x={80} y={412} text="Deploy:" size={15} color={OF.dim} />
          <ProgressBar x={160} y={403} w={480} h={12}
            progress={animate({ from: 0, to: 1, start: 5.5, end: 7.2 })(lt)}
            color={OF.green} />
          {lt > 7.0 && <PxText x={660} y={412} text="LIVE" size={15} color={OF.green} />}
        </g>
      )}

      {lt > 7.4 && (
        <PxText x={80} y={450} text="✓ 6 pages live. Deploy hook triggered." size={15} color={OF.green} />
      )}
    </Sprite>
  )
}

// ── Scene 4: Leads Flow (23–31s) ──────────────────────────────────────────────

const LEADS = [
  { src: 'organic/google',    page: '/best-workflow-automation-toronto', t: 0.6 },
  { src: 'direct',            page: '/acme-corp-services',               t: 1.8 },
  { src: 'organic/google',    page: '/workflow-automation-guide-2026',   t: 3.0 },
  { src: 'referral/linkedin', page: '/',                                 t: 4.2 },
]

function SceneLeads() {
  const t = useTime()
  const lt = t - 23
  return (
    <Sprite start={23} end={31}>
      <PxText x={80} y={130} text="$ crm.capture --watch --tenant acme-corp" size={17} color={OF.cyan} />
      <PxText x={80} y={158} text="Watching for visitors..." size={15} color={OF.dim} />

      {/* Lead events */}
      {LEADS.map((l, i) => lt > l.t && (
        <g key={i}>
          <Panel x={80} y={178 + i * 60} w={820} h={48} color={OF.cyan} opacity={0.4} />
          <PxText x={96} y={204 + i * 60} text={`src: ${l.src}`} size={14} color={OF.cyan} />
          <PxText x={380} y={204 + i * 60} text={`page: ${l.page}`} size={13} color={OF.frame} />
          {lt > l.t + 0.5 && (
            <PxText x={740} y={204 + i * 60} text="→ CRM" size={14} color={OF.green} />
          )}
        </g>
      ))}

      {/* Pipeline summary */}
      {lt > 5.0 && (
        <g>
          <PxText x={80} y={432} text="Pipeline:" size={15} color={OF.dim} />
          {['lead', 'qualified', 'proposal', 'closed'].map((stage, i) => (
            <g key={stage}>
              <Panel x={160 + i * 180} y={420} w={160} h={32} color={i === 0 ? OF.frame : OF.dimC} />
              <PxText x={240 + i * 180} y={440} text={stage} size={14} color={i === 0 ? OF.frame : OF.dim} align="center" />
              <PxText x={240 + i * 180} y={458} text={i === 0 ? '4' : '0'} size={14} color={OF.green} align="center" />
            </g>
          ))}
        </g>
      )}

      {lt > 7.0 && (
        <PxText x={80} y={490} text="✓ 4 contacts created. Stage: lead." size={15} color={OF.green} />
      )}
    </Sprite>
  )
}

// ── Scene 5: Economy (31–39s) ─────────────────────────────────────────────────

const LEDGER = [
  { type: 'USAGE',   desc: 'content_strategy · 1200 tokens',    amount: '-0.024',  color: OF.red,   t: 0.5 },
  { type: 'USAGE',   desc: 'publish · 6 pages · CF Pages',      amount: '-0.006',  color: OF.red,   t: 1.4 },
  { type: 'REVENUE', desc: 'acme-corp · monthly retainer',       amount: '+499.00', color: OF.green, t: 2.4 },
  { type: 'USAGE',   desc: 'seo-agent · crawl · 240 URLs',       amount: '-0.048',  color: OF.red,   t: 3.3 },
  { type: 'REVENUE', desc: 'acme-corp · upsell: crm module',     amount: '+149.00', color: OF.green, t: 4.3 },
]

function SceneEconomy() {
  const t = useTime()
  const lt = t - 31
  return (
    <Sprite start={31} end={39}>
      <PxText x={80} y={130} text="$ economy.ledger --tenant acme-corp" size={17} color={OF.cyan} />

      {/* Ledger rows */}
      {LEDGER.map((e, i) => lt > e.t && (
        <g key={i}>
          <PxText x={80}  y={168 + i * 40} text={e.type}   size={14} color={e.color} />
          <PxText x={220} y={168 + i * 40} text={e.desc}   size={13} color={OF.dim} />
          <PxText x={820} y={168 + i * 40} text={e.amount} size={14} color={e.color} align="right" />
        </g>
      ))}

      {/* Running balance */}
      {lt > 5.0 && (
        <g>
          <line x1={80} y1={372} x2={840} y2={372} stroke={OF.dim} strokeWidth={1} />
          <PxText x={80}  y={396} text="Balance:" size={16} color={OF.dim} />
          <PxText x={820} y={396} text={`+${(498 + (lt > 5 ? (lt - 5) * 29 : 0)).toFixed(2)}`} size={18} color={OF.green} align="right" />
        </g>
      )}

      {lt > 7.2 && (
        <PxText x={80} y={440} text="✓ Wallet healthy. MRR: +$648. Operating margin: 86%." size={15} color={OF.green} />
      )}
    </Sprite>
  )
}

// ── Scene 6: Memory (39–46s) ──────────────────────────────────────────────────

const RECALLS = [
  { query: 'acme-corp brand voice',            result: '"direct, no jargon, builder tone"',              t: 0.6 },
  { query: 'acme-corp top performing pages',   result: 'workflow-automation-guide-2026 · 340 visits',   t: 2.2 },
  { query: 'acme-corp last seo audit',         result: '2026-04-20 · score 71/100 · 3 issues',          t: 3.8 },
]

function SceneMemory() {
  const t = useTime()
  const lt = t - 39
  return (
    <Sprite start={39} end={46}>
      <PxText x={80} y={130} text="$ mirror.recall --tenant acme-corp" size={17} color={OF.cyan} />
      <PxText x={80} y={156} text="Memory store: Mirror (pgvector)" size={14} color={OF.dim} />

      {RECALLS.map((r, i) => lt > r.t && (
        <g key={i}>
          <PxText x={80}  y={196 + i * 70} text={`query: "${r.query}"`} size={14} color={OF.frame} />
          {lt > r.t + 0.5 && (
            <PxText x={100} y={218 + i * 70} text={`→ ${r.result}`} size={14} color={OF.cyan} />
          )}
        </g>
      ))}

      {lt > 4.8 && (
        <g>
          <PxText x={80} y={418} text="Archiving session engrams..." size={14} color={OF.dim} />
          <ProgressBar x={80} y={435} w={720} h={8}
            progress={animate({ from: 0, to: 1, start: 4.8, end: 6.4 })(lt)}
            color={OF.cyan} />
          {lt > 6.2 && <PxText x={80} y={462} text="✓ 14 engrams stored. Next cycle: tomorrow 06:00." size={15} color={OF.green} />}
        </g>
      )}
    </Sprite>
  )
}

// ── Scene 7: Organism (46–48s) ────────────────────────────────────────────────

const SYSTEMS = [
  { name: 'Inkwell Worker', status: 'RUNNING', color: OF.green },
  { name: 'SOS Bus',        status: 'RUNNING', color: OF.green },
  { name: 'Mirror Memory',  status: 'RUNNING', color: OF.green },
  { name: 'Agent Squad',    status: 'ACTIVE',  color: OF.cyan  },
  { name: 'Economy',        status: 'HEALTHY', color: OF.frame },
  { name: 'Organism Loop',  status: 'TICKING', color: OF.green },
]

function SceneOrganism() {
  const t = useTime()
  const lt = t - 46
  return (
    <Sprite start={46} end={48}>
      <PxText x={640} y={200} text="ORGANISM" size={48} color={OF.frame} align="center" />
      <PxText x={640} y={240} text="STATUS: ACTIVE" size={22} color={OF.green} align="center" />

      {SYSTEMS.map((s, i) => (
        <g key={s.name}>
          <StatusDot
            x={300 + (i % 3) * 240}
            y={295 + Math.floor(i / 3) * 50}
            color={s.color}
            label={`${s.name}: ${s.status}`}
          />
        </g>
      ))}

      <PxText x={640} y={420} text="The business runs itself." size={20} color={OF.dim} align="center" />

      {/* Pulse ring */}
      <circle cx={640} cy={350} r={animate({ from: 0, to: 120, start: 0, end: 2 })(lt)}
        stroke={OF.frame} strokeWidth={1} fill="none"
        opacity={animate({ from: 0.6, to: 0, start: 0, end: 2 })(lt)} />
    </Sprite>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell() {
  const { time, duration } = useTimeline()
  const scene = SCENES.find(s => time >= s.start && time < s.end) ?? SCENES[SCENES.length - 1]

  return (
    <svg width={1280} height={720} style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <pattern id="scanlines-mm" x="0" y="0" width="1" height="4" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1" height="2" fill="rgba(0,0,0,1)" />
        </pattern>
        <radialGradient id="phosphor-mm" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={OF.frame} stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id="glow-mm">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width={1280} height={720} fill={OF.bg} />
      <rect width={1280} height={720} fill="url(#scanlines-mm)" opacity={0.07} />
      <rect width={1280} height={720} fill="url(#phosphor-mm)" opacity={0.04} />

      {/* Outer frame */}
      <rect x={8} y={8} width={1264} height={704} stroke={OF.frame} strokeWidth={1.5} fill="none" rx={3} />

      {/* Corner ticks */}
      <CornerTick x={8} y={8} size={12} color={OF.frame} />
      <CornerTick x={1272} y={8} size={12} color={OF.frame} flip />
      <CornerTick x={8} y={712} size={12} color={OF.frame} />
      <CornerTick x={1272} y={712} size={12} color={OF.frame} flip />

      {/* Title bar */}
      <rect x={8} y={8} width={1264} height={44} fill={OF.glass} />
      <line x1={8} y1={52} x2={1272} y2={52} stroke={OF.frame} strokeWidth={1} />
      <PxText x={640} y={35} text="INKWELL — ORGANISM RUNTIME" size={20} color={OF.frame} align="center" />

      {/* Scene label strip */}
      <rect x={8} y={52} width={200} height={36} fill={`${OF.frame}18`} />
      <PxText x={18} y={74} text={`SCENE: ${scene.label}`} size={16} color={OF.frame} />
      <PxText x={230} y={74} text={scene.sub} size={14} color={OF.dim} />

      {/* Timeline tick */}
      <PxText x={1200} y={74} text={`t=${time.toFixed(1)}s`} size={14} color={OF.dim} align="right" />

      {/* Scene indicator dots */}
      {SCENES.map((s, i) => (
        <rect
          key={s.label}
          x={1280 - 16 - i * 14}
          y={60}
          width={10}
          height={10}
          fill={time >= s.start && time < s.end ? OF.frame : OF.dim}
          rx={1}
        />
      ))}

      {/* Inner frame */}
      <rect x={24} y={60} width={1232} height={638} stroke={OF.dim} strokeWidth={1} fill="none" rx={2} />

      {/* Scene content */}
      <SceneIntake />
      <SceneAgents />
      <SceneContent />
      <SceneLeads />
      <SceneEconomy />
      <SceneMemory />
      <SceneOrganism />

      {/* Bottom strip */}
      <line x1={8} y1={684} x2={1272} y2={684} stroke={OF.dim} strokeWidth={1} />
      <PxText x={18} y={704} text="INKWELL · plugin kernel · CF Workers" size={13} color={OF.dim} />

      {/* Progress bar at bottom */}
      <rect x={8} y={716} width={1264 * (time / duration)} height={4} fill={OF.frame} />
    </svg>
  )
}

// ── Outer wrapper ─────────────────────────────────────────────────────────────

function OrganismAnimationInner() {
  return (
    <div style={{ position: 'relative', width: 1280, height: 720 }}>
      <Shell />
    </div>
  )
}

export function OrganismAnimation({ height = '100%' }: { height?: string | number }) {
  return (
    <div style={{ width: '100%', height }}>
      <Stage duration={48} loop background={OF.bg} persistKey="inkwell-organism-anim" showControls>
        <OrganismAnimationInner />
      </Stage>
    </div>
  )
}
