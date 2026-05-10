import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Progress } from '../../../src/components/ui/progress'
import { Input } from '../../../src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../src/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../src/components/ui/table'
import { cn } from '../../../src/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
type MemberStatus = 'active' | 'invited' | 'suspended'

interface Member {
  id: string
  email: string
  role: MemberRole
  status: MemberStatus
  created_at: string
}

interface SeatsData {
  members: Member[]
  seats_used: number
  seats_total: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  return (localStorage.getItem('mumega_api_url') ?? window.location.origin)
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('mumega_auth_token') ?? ''
}

function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase()
  const token = getAuthToken()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json() as Promise<T>
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function roleBadgeClass(role: MemberRole): string {
  switch (role) {
    case 'owner':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
    case 'admin':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'
    case 'manager':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
    default:
      return 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
  }
}

function statusBadgeClass(status: MemberStatus): string {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
    case 'invited':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
    case 'suspended':
      return 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
    default:
      return 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
  }
}

const ROLE_OPTIONS: MemberRole[] = ['viewer', 'member', 'manager', 'admin']

// ---------------------------------------------------------------------------
// Invite form sub-component
// ---------------------------------------------------------------------------

interface InviteFormProps {
  onInvited: () => void
  onCancel: () => void
}

function InviteForm({ onInvited, onCancel }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    setSubmitting(true)
    setError(null)
    apiFetch<unknown>('/api/seats/invite', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), role }),
    })
      .then(() => { onInvited() })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Invite failed. Try again.')
        setSubmitting(false)
      })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Role
        </label>
        <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SeatsPanel() {
  const [data, setData] = useState<SeatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [viewerRole, setViewerRole] = useState<MemberRole>('viewer')
  const [removing, setRemoving] = useState<string | null>(null)

  function load() {
    apiFetch<SeatsData>('/api/seats')
      .then((d) => {
        setData(d)
        setLoading(false)

        // Determine viewer's own role from localStorage
        const storedRole = typeof window !== 'undefined'
          ? localStorage.getItem('mumega_user_role')
          : null
        if (storedRole) setViewerRole(storedRole as MemberRole)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load team data.')
        setLoading(false)
      })
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mumega_auth_token') : null
    if (!token) {
      setError('Not authenticated. Please log in.')
      setLoading(false)
      return
    }
    load()
  }, [])

  function handleRemove(memberId: string) {
    setRemoving(memberId)
    apiFetch<unknown>(`/api/seats/${memberId}`, { method: 'DELETE' })
      .then(() => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.filter((m) => m.id !== memberId),
                seats_used: Math.max(0, prev.seats_used - 1),
              }
            : prev
        )
        setRemoving(null)
      })
      .catch(() => { setRemoving(null) })
  }

  const canManage = viewerRole === 'owner' || viewerRole === 'admin'
  const seatPct = data && data.seats_total > 0
    ? Math.min(100, Math.round((data.seats_used / data.seats_total) * 100))
    : 0

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Seats usage */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-sm font-semibold">Team Seats</CardTitle>
              {!loading && data && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.seats_used} of {data.seats_total} seats used
                </p>
              )}
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={() => setShowInvite((v) => !v)}
                variant={showInvite ? 'outline' : 'default'}
              >
                {showInvite ? 'Cancel' : '+ Invite'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <div className="h-3 w-full rounded bg-border opacity-50" />
          ) : (
            <Progress value={seatPct} className="h-2" />
          )}

          {showInvite && canManage && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <InviteForm
                onInvited={() => {
                  setShowInvite(false)
                  load()
                }}
                onCancel={() => setShowInvite(false)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Members</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading…</p>
          ) : !data || data.members.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-sm">{member.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', roleBadgeClass(member.role))}
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', statusBadgeClass(member.status))}
                      >
                        {member.status === 'invited' ? 'invite pending' : member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(member.created_at)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removing === member.id}
                            onClick={() => handleRemove(member.id)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            {removing === member.id ? 'Removing…' : 'Remove'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
