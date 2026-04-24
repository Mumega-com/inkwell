'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface GraphNode {
  slug: string
  title: string
  tags: string[]
  url: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphEdge {
  source: string
  target: string
  type: string
}

interface KnowledgeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function KnowledgeGraph({ nodes: initialNodes, edges }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const animRef = useRef<number>(0)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width: Math.floor(width), height: Math.max(400, Math.floor(height)) })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    nodesRef.current = initialNodes.map((n, i) => ({
      ...n,
      x: dimensions.width / 2 + Math.cos((i / initialNodes.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 50,
      y: dimensions.height / 2 + Math.sin((i / initialNodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      vx: 0,
      vy: 0,
    }))
  }, [initialNodes, dimensions])

  const simulate = useCallback(() => {
    const nodes = nodesRef.current
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = dimensions
    const nodeMap = new Map(nodes.map((n) => [n.slug, n]))

    // Center attraction
    for (const node of nodes) {
      node.vx! += (width / 2 - node.x!) * 0.001
      node.vy! += (height / 2 - node.y!) * 0.001
    }

    // Node repulsion (O(N^2) optimized to N(N-1)/2)
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const other = nodes[j]
        const dx = node.x! - other.x!
        const dy = node.y! - other.y!
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const force = 800 / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        node.vx! += fx
        node.vy! += fy
        other.vx! -= fx
        other.vy! -= fy
      }
    }

    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) continue

      const dx = target.x! - source.x!
      const dy = target.y! - source.y!
      const dist = Math.sqrt(dx * dx + dy * dy)
      const force = (dist - 120) * 0.005

      source.vx! += (dx / dist) * force
      source.vy! += (dy / dist) * force
      target.vx! -= (dx / dist) * force
      target.vy! -= (dy / dist) * force
    }

    for (const node of nodes) {
      node.vx! *= 0.85
      node.vy! *= 0.85
      node.x! += node.vx!
      node.y! += node.vy!
      node.x = Math.max(40, Math.min(width - 40, node.x!))
      node.y = Math.max(40, Math.min(height - 40, node.y!))
    }

    ctx.clearRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(212, 160, 23, 0.15)'
    ctx.lineWidth = 1
    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) continue
      ctx.beginPath()
      ctx.moveTo(source.x!, source.y!)
      ctx.lineTo(target.x!, target.y!)
      ctx.stroke()
    }

    for (const node of nodes) {
      const isHovered = hoveredNode?.slug === node.slug
      const radius = isHovered ? 8 : 5

      if (isHovered) {
        ctx.beginPath()
        ctx.arc(node.x!, node.y!, 16, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(212, 160, 23, 0.15)'
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? '#D4A017' : 'rgba(212, 160, 23, 0.7)'
      ctx.fill()

      if (isHovered) {
        ctx.font = '12px system-ui, sans-serif'
        ctx.fillStyle = '#EDEDF0'
        ctx.textAlign = 'center'
        ctx.fillText(node.title, node.x!, node.y! - 16)
      }
    }

    animRef.current = requestAnimationFrame(simulate)
  }, [dimensions, edges, hoveredNode])

  useEffect(() => {
    animRef.current = requestAnimationFrame(simulate)
    return () => cancelAnimationFrame(animRef.current)
  }, [simulate])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let found: GraphNode | null = null
      for (const node of nodesRef.current) {
        const dx = mx - node.x!
        const dy = my - node.y!
        if (dx * dx + dy * dy < 200) {
          found = node
          break
        }
      }
      setHoveredNode(found)
    },
    []
  )

  const handleClick = useCallback(() => {
    if (hoveredNode) {
      window.location.href = hoveredNode.url
    }
  }, [hoveredNode])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: '400px',
        height: '60vh',
        position: 'relative',
        borderRadius: '6px',
        border: '1px solid var(--ink-border)',
        background: 'var(--ink-surface)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          cursor: hoveredNode ? 'pointer' : 'default',
        }}
      />
    </div>
  )
}
