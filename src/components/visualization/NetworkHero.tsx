import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  type: 'agent' | 'tool' | 'topic' | 'lab'
  pulse: number
  pulseSpeed: number
  connections: number
}

const COLORS: Record<string, [number, number, number]> = {
  agent: [212, 160, 23],
  tool: [6, 182, 212],
  topic: [16, 185, 129],
  lab: [167, 139, 250],
}

export function NetworkHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    const nodes: Node[] = []
    let time = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.scale(dpr, dpr)
    }

    function init() {
      resize()
      nodes.length = 0

      // Spawn nodes in organic clusters
      const clusters = [
        { cx: width * 0.2, cy: height * 0.35, type: 'agent' as const, count: 6 },
        { cx: width * 0.5, cy: height * 0.5, type: 'topic' as const, count: 5 },
        { cx: width * 0.8, cy: height * 0.4, type: 'tool' as const, count: 5 },
        { cx: width * 0.35, cy: height * 0.7, type: 'lab' as const, count: 4 },
        { cx: width * 0.65, cy: height * 0.25, type: 'agent' as const, count: 3 },
        { cx: width * 0.15, cy: height * 0.65, type: 'tool' as const, count: 3 },
        { cx: width * 0.85, cy: height * 0.7, type: 'topic' as const, count: 3 },
      ]

      for (const cluster of clusters) {
        for (let i = 0; i < cluster.count; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * Math.min(width, height) * 0.12
          nodes.push({
            x: cluster.cx + Math.cos(angle) * dist,
            y: cluster.cy + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            radius: 1.5 + Math.random() * 2,
            type: cluster.type,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.005 + Math.random() * 0.01,
            connections: 0,
          })
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height)
      time += 0.003

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const maxDist = Math.min(width, height) * 0.2

      // Reset connection counts
      for (const n of nodes) n.connections = 0

      // Draw mycelium connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < maxDist && a.connections < 4 && b.connections < 4) {
            a.connections++
            b.connections++
            const strength = 1 - dist / maxDist

            // Organic branching path (bezier with drift)
            const drift = Math.sin(time * 2 + i + j) * 15 * strength
            const mx1 = (a.x * 0.6 + b.x * 0.4) + drift
            const my1 = (a.y * 0.6 + b.y * 0.4) - drift * 0.7
            const mx2 = (a.x * 0.4 + b.x * 0.6) - drift * 0.5
            const my2 = (a.y * 0.4 + b.y * 0.6) + drift * 0.3

            const alpha = strength * strength * 0.12

            ctx!.beginPath()
            ctx!.moveTo(a.x, a.y)
            ctx!.bezierCurveTo(mx1, my1, mx2, my2, b.x, b.y)

            const ca = COLORS[a.type]
            const cb = COLORS[b.type]
            const gradient = ctx!.createLinearGradient(a.x, a.y, b.x, b.y)
            gradient.addColorStop(0, `rgba(${ca[0]},${ca[1]},${ca[2]},${alpha})`)
            gradient.addColorStop(1, `rgba(${cb[0]},${cb[1]},${cb[2]},${alpha})`)
            ctx!.strokeStyle = gradient
            ctx!.lineWidth = strength * 1.2
            ctx!.stroke()
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const c = COLORS[node.type]
        const pulseScale = 1 + Math.sin(node.pulse) * 0.3
        const r = node.radius * pulseScale

        // Mouse proximity glow
        const mdx = node.x - mx
        const mdy = node.y - my
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        const mouseGlow = mDist < 150 ? (1 - mDist / 150) * 0.3 : 0

        // Outer glow
        const glowR = r * (5 + mouseGlow * 8)
        const glow = ctx!.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
        glow.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.08 + mouseGlow})`)
        glow.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`)
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, glowR, 0, Math.PI * 2)
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.7 + mouseGlow})`
        ctx!.fill()
      }
    }

    function update() {
      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy
        node.pulse += node.pulseSpeed

        // Soft boundary
        const m = 40
        if (node.x < m) node.vx += 0.008
        if (node.x > width - m) node.vx -= 0.008
        if (node.y < m) node.vy += 0.008
        if (node.y > height - m) node.vy -= 0.008

        // Organic drift (perlin-like)
        node.vx += Math.sin(time * 3 + node.y * 0.01) * 0.003
        node.vy += Math.cos(time * 3 + node.x * 0.01) * 0.003

        // Mouse repulsion (gentle)
        const mdx = node.x - mouseRef.current.x
        const mdy = node.y - mouseRef.current.y
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mDist < 120 && mDist > 0) {
          const force = (1 - mDist / 120) * 0.02
          node.vx += (mdx / mDist) * force
          node.vy += (mdy / mDist) * force
        }

        // Damping
        node.vx *= 0.995
        node.vy *= 0.995
      }
    }

    function loop() {
      update()
      draw()
      animRef.current = requestAnimationFrame(loop)
    }

    init()
    loop()

    const onResize = () => init()
    const onMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => { mouseRef.current = { x: -1000, y: -1000 } }

    window.addEventListener('resize', onResize)
    canvas!.addEventListener('mousemove', onMove)
    canvas!.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
      canvas!.removeEventListener('mousemove', onMove)
      canvas!.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    />
  )
}
