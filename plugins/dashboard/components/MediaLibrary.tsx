import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { STORAGE_KEYS } from '../../lib/storage-keys'

interface MediaAsset {
  id: string
  filename: string
  contentType: string
  r2Key: string
  width?: number
  height?: number
  sizeBytes: number
  altText?: string
  description?: string
  tags: string[]
  nsfwScore?: number
  transcript?: string
  variants: Record<string, string>
  sourceType: 'upload' | 'generate' | 'import'
  createdAt: string
}

type ExpandedAsset = MediaAsset | null

function headers(token: string, json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function typeBadgeClass(ct: string): string {
  if (ct.startsWith('image/')) return 'text-emerald-400 border-emerald-400/30'
  if (ct.startsWith('video/')) return 'text-purple-400 border-purple-400/30'
  if (ct.startsWith('audio/')) return 'text-amber-400 border-amber-400/30'
  return 'text-muted-foreground'
}

function AssetCard({ asset, onExpand, onDelete }: {
  asset: MediaAsset
  onExpand: (a: MediaAsset) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const thumbUrl = asset.variants?.thumbnail || asset.variants?.original

  return (
    <Card
      className="group cursor-pointer overflow-hidden border transition-colors hover:border-[var(--ink-primary)]"
      style={{ borderRadius: 'var(--ink-radius)' }}
      onClick={() => onExpand(asset)}
    >
      <div className="aspect-square bg-[var(--ink-surface)] flex items-center justify-center overflow-hidden">
        {thumbUrl
          ? <img src={thumbUrl} alt={asset.altText || asset.filename} className="h-full w-full object-cover" />
          : <span className="text-3xl text-muted-foreground">{asset.contentType.startsWith('video/') ? '\u25B6' : '\u2756'}</span>}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-sm font-medium truncate text-foreground">{asset.filename}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[0.65rem] ${typeBadgeClass(asset.contentType)}`}>
            {asset.contentType.split('/')[1]?.toUpperCase() || asset.contentType}
          </Badge>
          {asset.tags.slice(0, 2).map(t => (
            <Badge key={t} variant="secondary" className="text-[0.65rem]">{t}</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(asset.createdAt).toLocaleDateString()}
          {' \u00B7 '}
          {formatBytes(asset.sizeBytes)}
        </p>
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          {confirmDelete
            ? <div className="flex gap-1">
                <Button variant="destructive" size="sm" className="text-xs h-6 px-2" onClick={() => onDelete(asset.id)}>Confirm</Button>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            : <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        </div>
      </div>
    </Card>
  )
}

function ExpandedPanel({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const fullUrl = asset.variants?.original || asset.variants?.thumbnail
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--ink-surface)] border border-[var(--ink-border)] p-6 flex flex-col gap-4"
        style={{ borderRadius: 'var(--ink-radius)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-foreground">{asset.filename}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>X</Button>
        </div>
        {fullUrl && (
          <img src={fullUrl} alt={asset.altText || asset.filename} className="w-full rounded-md object-contain max-h-80" />
        )}
        {(() => {
          const rows: [string, string][] = [
            ['Type', asset.contentType], ['Size', formatBytes(asset.sizeBytes)],
            ['Source', asset.sourceType], ['Created', new Date(asset.createdAt).toLocaleString()],
          ]
          if (asset.width) rows.push(['Dimensions', `${asset.width}x${asset.height}`])
          if (asset.nsfwScore != null) rows.push(['NSFW', `${(asset.nsfwScore * 100).toFixed(0)}%`])
          return (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {rows.map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {v}</div>)}
            </div>
          )
        })()}
        {[['Alt text', asset.altText], ['Description', asset.description], ['Transcript', asset.transcript]].map(([label, val]) =>
          val ? (
            <div key={label as string}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-sm ${label === 'Transcript' ? 'text-muted-foreground line-clamp-6' : ''}`}>{val}</p>
            </div>
          ) : null
        )}
        {asset.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {asset.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MediaLibrary() {
  const [apiUrl, setApiUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ExpandedAsset>(null)
  const [generating, setGenerating] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const url = localStorage.getItem(STORAGE_KEYS.apiUrl) || window.location.origin
    const token = localStorage.getItem(STORAGE_KEYS.authToken) || ''
    setApiUrl(url)
    setAuthToken(token)
  }, [])

  const fetchAssets = useCallback(async (url: string, token: string, q?: string, c?: string) => {
    if (!token) { setLoading(false); return }
    try {
      const p = new URLSearchParams({ limit: '20' })
      if (q) p.set('q', q)
      if (c) p.set('cursor', c)
      const res = await fetch(`${url}/api/media?${p}`, { headers: headers(token) })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list: MediaAsset[] = data.assets || []
      setAssets(prev => c ? [...prev, ...list] : list)
      setCursor(data.cursor)
    } catch { setError('Failed to load media assets.') }
    finally { setLoading(false); setSearching(false) }
  }, [])

  useEffect(() => {
    if (apiUrl && authToken) fetchAssets(apiUrl, authToken)
  }, [apiUrl, authToken, fetchAssets])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setSearching(true); setCursor(undefined)
    fetchAssets(apiUrl, authToken, query.trim() || undefined)
  }

  function handleLoadMore() {
    if (!cursor) return
    setSearching(true); fetchAssets(apiUrl, authToken, query.trim() || undefined, cursor)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${apiUrl}/api/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form })
      if (!res.ok) throw new Error(`${res.status}`)
      const asset: MediaAsset = await res.json()
      setAssets(prev => [asset, ...prev])
    } catch { setError('Upload failed.') }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!genPrompt.trim()) return
    setGenerating(true); setError('')
    try {
      const res = await fetch(`${apiUrl}/api/media/generate`, { method: 'POST', headers: headers(authToken, true), body: JSON.stringify({ prompt: genPrompt.trim() }) })
      if (!res.ok) throw new Error(`${res.status}`)
      const asset: MediaAsset = await res.json()
      setAssets(prev => [asset, ...prev]); setGenPrompt('')
    } catch { setError('Generation failed.') }
    finally { setGenerating(false) }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/media/${id}`, { method: 'DELETE', headers: headers(authToken) })
      if (!res.ok) throw new Error(`${res.status}`)
      setAssets(prev => prev.filter(a => a.id !== id))
      if (expanded?.id === id) setExpanded(null)
    } catch { setError('Delete failed.') }
  }

  if (!authToken && !loading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm mb-4">Media library requires authentication. Configure your API settings first.</p>
        <Button asChild variant="outline" size="sm"><a href="/dashboard/settings">Go to Settings</a></Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search media..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" variant="outline" size="sm" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </form>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Upload</Button>
        </div>
      </div>

      {/* Generate */}
      <form onSubmit={handleGenerate} className="flex gap-2">
        <input
          value={genPrompt}
          onChange={e => setGenPrompt(e.target.value)}
          placeholder="Generate image from prompt..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" disabled={generating || !genPrompt.trim()}>
          {generating ? 'Generating...' : 'Generate'}
        </Button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8">Loading media...</p>
      ) : assets.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">No media assets found. Upload or generate one to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map(a => (
            <AssetCard key={a.id} asset={a} onExpand={setExpanded} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={searching}>
            {searching ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}

      {expanded && <ExpandedPanel asset={expanded} onClose={() => setExpanded(null)} />}
    </div>
  )
}
