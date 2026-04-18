import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Input } from '../../../src/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../src/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../src/components/ui/select'
import { ConnectPanel } from './ConnectPanel'
import { cn } from '../../../src/lib/utils'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
import { STORAGE_KEYS } from '../../lib/storage-keys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DevSettings {
  apiUrl: string
  authToken: string
  tenantSlug: string
}

interface TenantProfile {
  businessName: string
  domain: string
  industry: string
  logoUrl: string
  plan: string
  planPrice: number
  budgetDeposited: number
  budgetUsed: number
}

interface TeamMember {
  id: string
  email: string
  role: 'owner' | 'manager' | 'viewer'
  addedAt: string
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function FieldRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline gap-4 text-sm">
      <span className="w-28 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className={cn('break-all text-foreground', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-semibold text-muted-foreground"
    >
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground opacity-75">{children}</p>
}

// ---------------------------------------------------------------------------
// Tab 1 — Business Profile
// ---------------------------------------------------------------------------
function BusinessProfileTab({
  dev,
}: {
  dev: DevSettings
}) {
  const [profile, setProfile] = useState<TenantProfile>({
    businessName: '',
    domain: '',
    industry: '',
    logoUrl: '',
    plan: 'Growth Plan',
    planPrice: 149,
    budgetDeposited: 0,
    budgetUsed: 0,
  })
  const [editName, setEditName] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dev.apiUrl || !dev.authToken) {
      setLoading(false)
      return
    }
    fetch(`${dev.apiUrl}/my/dashboard`, {
      headers: { Authorization: `Bearer ${dev.authToken}` },
    })
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const p: TenantProfile = {
          businessName:
            typeof d.business_name === 'string'
              ? d.business_name
              : dev.tenantSlug || 'Your Business',
          domain:
            typeof d.domain === 'string' ? d.domain : `${dev.tenantSlug}.example.com`,
          industry: typeof d.industry === 'string' ? d.industry : '—',
          logoUrl: typeof d.logo_url === 'string' ? d.logo_url : '',
          plan: typeof d.plan === 'string' ? d.plan : 'Growth Plan',
          planPrice: typeof d.plan_price === 'number' ? d.plan_price : 149,
          budgetDeposited:
            typeof d.budget_deposited === 'number' ? d.budget_deposited : 0,
          budgetUsed: typeof d.budget_used === 'number' ? d.budget_used : 0,
        }
        setProfile(p)
        setEditName(p.businessName)
      })
      .catch(() => {
        setEditName(dev.tenantSlug || 'Your Business')
      })
      .finally(() => setLoading(false))
  }, [dev.apiUrl, dev.authToken, dev.tenantSlug])

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setProfile((prev) => ({ ...prev, businessName: editName }))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Logo + name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Identity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Logo placeholder */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-2xl text-muted-foreground">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt="Business logo"
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                '◎'
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                {profile.businessName}
              </span>
              <Button variant="outline" size="sm" disabled className="w-fit text-xs">
                Upload logo (coming soon)
              </Button>
            </div>
          </div>

          {/* Editable name */}
          <form onSubmit={handleSaveName} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="bizName">Business Name</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="bizName"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="Your Business Name"
                />
                <Button type="submit" variant="default" className="shrink-0">
                  Save
                </Button>
              </div>
            </div>
            {saved && (
              <span className="text-sm font-semibold text-emerald-500">✓ Saved</span>
            )}
          </form>

          {/* Read-only fields */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
            <FieldRow label="Domain" value={profile.domain} mono />
            <FieldRow label="Industry" value={profile.industry} />
          </div>
          <FieldHint>
            Domain and industry are set by your account. Contact support to change them.
          </FieldHint>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 — Billing
// ---------------------------------------------------------------------------
function BillingTab({ dev }: { dev: DevSettings }) {
  const [profile, setProfile] = useState<TenantProfile>({
    businessName: '',
    domain: '',
    industry: '',
    logoUrl: '',
    plan: 'Growth Plan',
    planPrice: 149,
    budgetDeposited: 500,
    budgetUsed: 213,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dev.apiUrl || !dev.authToken) {
      setLoading(false)
      return
    }
    fetch(`${dev.apiUrl}/my/dashboard`, {
      headers: { Authorization: `Bearer ${dev.authToken}` },
    })
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        setProfile((prev) => ({
          ...prev,
          plan: typeof d.plan === 'string' ? d.plan : 'Growth Plan',
          planPrice: typeof d.plan_price === 'number' ? d.plan_price : 149,
          budgetDeposited:
            typeof d.budget_deposited === 'number' ? d.budget_deposited : 500,
          budgetUsed: typeof d.budget_used === 'number' ? d.budget_used : 213,
        }))
      })
      .catch(() => {
        // leave defaults
      })
      .finally(() => setLoading(false))
  }, [dev.apiUrl, dev.authToken])

  const budgetRemaining = profile.budgetDeposited - profile.budgetUsed
  const usagePct =
    profile.budgetDeposited > 0
      ? Math.min(100, Math.round((profile.budgetUsed / profile.budgetDeposited) * 100))
      : 0

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Plan card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold text-foreground">
                {profile.plan}
              </span>
              <span className="text-sm text-muted-foreground">
                ${profile.planPrice}/month — billed monthly
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <a
                href="https://billing.stripe.com/p/login/placeholder"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage Billing
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
              VISA
            </span>
            <span className="text-sm text-foreground">Visa ending in 4242</span>
          </div>
          <Button variant="outline" size="sm" disabled>
            Update card
          </Button>
        </CardContent>
      </Card>

      {/* Usage this month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage This Month</CardTitle>
          <CardDescription>AI credits consumed from your deposited budget</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Deposited</span>
              <span className="text-lg font-bold text-foreground">
                ${profile.budgetDeposited}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Used</span>
              <span className="text-lg font-bold text-amber-500">
                ${profile.budgetUsed}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Remaining</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  budgetRemaining < 50 ? 'text-red-500' : 'text-emerald-500'
                )}
              >
                ${budgetRemaining}
              </span>
            </div>
          </div>

          {/* Usage bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Usage</span>
              <span>{usagePct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePct >= 90
                    ? 'bg-red-500'
                    : usagePct >= 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                )}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 — Team Access
// ---------------------------------------------------------------------------
const ROLE_LABELS: Record<TeamMember['role'], string> = {
  owner: 'Owner',
  manager: 'Manager',
  viewer: 'Viewer',
}

function TeamAccessTab({ dev }: { dev: DevSettings }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('viewer')
  const [inviteSent, setInviteSent] = useState(false)

  // seed owner from tenantSlug on first load
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.teamMembers)
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setMembers(parsed as TeamMember[])
          return
        }
      } catch {
        // ignore parse errors
      }
    }
    // Default: just the owner placeholder
    const seed: TeamMember[] = [
      {
        id: 'owner',
        email: 'you@yourbusiness.com',
        role: 'owner',
        addedAt: new Date().toISOString(),
      },
    ]
    setMembers(seed)
    localStorage.setItem(STORAGE_KEYS.teamMembers, JSON.stringify(seed))
  }, [])

  function saveMembers(next: TeamMember[]) {
    setMembers(next)
    localStorage.setItem(STORAGE_KEYS.teamMembers, JSON.stringify(next))
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      addedAt: new Date().toISOString(),
    }
    saveMembers([...members, newMember])
    setInviteEmail('')
    setInviteRole('viewer')
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setShowInvite(false)
    }, 2500)
  }

  function handleRemove(id: string) {
    saveMembers(members.filter((m) => m.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Team Members</CardTitle>
            <CardDescription className="mt-0.5">
              People who have access to this dashboard
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowInvite((v) => !v)}
          >
            {showInvite ? 'Cancel' : 'Invite someone'}
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Invite form */}
          {showInvite && (
            <form
              onSubmit={handleInvite}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4"
            >
              <span className="text-sm font-semibold text-foreground">
                Invite a team member
              </span>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="inviteEmail">Email address</FieldLabel>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="inviteRole">Role</FieldLabel>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as TeamMember['role'])}
                >
                  <SelectTrigger id="inviteRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner — full access</SelectItem>
                    <SelectItem value="manager">Manager — can edit</SelectItem>
                    <SelectItem value="viewer">Viewer — read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm">
                  Send Invite
                </Button>
                {inviteSent && (
                  <span className="text-sm font-semibold text-emerald-500">
                    ✓ Added (real invites coming soon)
                  </span>
                )}
              </div>
              <FieldHint>
                Invites are stored locally for now. Full email invites ship in a future
                release.
              </FieldHint>
            </form>
          )}

          {/* Member list */}
          <div className="flex flex-col divide-y divide-border">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {m.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role]}
                    {m.role === 'owner' && ' · You'}
                  </span>
                </div>
                {m.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs text-red-500 hover:text-red-400"
                    onClick={() => handleRemove(m.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4 — Developer
// ---------------------------------------------------------------------------
function DeveloperTab({
  dev,
  onDevChange,
}: {
  dev: DevSettings
  onDevChange: (next: DevSettings) => void
}) {
  const [draft, setDraft] = useState<DevSettings>(dev)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  function handleChange(field: keyof DevSettings, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
    setTestStatus('idle')
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem(STORAGE_KEYS.apiUrl, draft.apiUrl.trim())
    localStorage.setItem(STORAGE_KEYS.authToken, draft.authToken.trim())
    localStorage.setItem(STORAGE_KEYS.tenantSlug, draft.tenantSlug.trim())
    onDevChange({
      apiUrl: draft.apiUrl.trim(),
      authToken: draft.authToken.trim(),
      tenantSlug: draft.tenantSlug.trim(),
    })
    setSaved(true)
  }

  async function handleTest() {
    if (!draft.apiUrl || !draft.authToken) return
    setTestStatus('testing')
    try {
      const res = await fetch(`${draft.apiUrl.trim()}/my/dashboard`, {
        headers: { Authorization: `Bearer ${draft.authToken.trim()}` },
      })
      setTestStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEYS.apiUrl)
    localStorage.removeItem(STORAGE_KEYS.authToken)
    localStorage.removeItem(STORAGE_KEYS.tenantSlug)
    const cleared: DevSettings = { apiUrl: '', authToken: '', tenantSlug: '' }
    setDraft(cleared)
    onDevChange(cleared)
    setSaved(false)
    setTestStatus('idle')
  }

  const hasValues = Boolean(draft.apiUrl || draft.authToken)

  return (
    <div className="flex flex-col gap-6">
      {/* Connection settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Connection</CardTitle>
          <CardDescription>
            Configure the API credentials used by this dashboard. Stored only in your
            browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="apiUrl">API URL</FieldLabel>
              <Input
                id="apiUrl"
                type="url"
                value={draft.apiUrl}
                onChange={(e) => handleChange('apiUrl', e.target.value)}
                placeholder="https://api.example.com"
                spellCheck={false}
                autoComplete="off"
              />
              <FieldHint>Base URL of your SaaS API (no trailing slash)</FieldHint>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="authToken">Auth Token</FieldLabel>
              <Input
                id="authToken"
                type="password"
                value={draft.authToken}
                onChange={(e) => handleChange('authToken', e.target.value)}
                placeholder="sk-…"
                spellCheck={false}
                autoComplete="off"
              />
              <FieldHint>Bearer token for your tenant account</FieldHint>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="tenantSlug">Tenant Slug</FieldLabel>
              <Input
                id="tenantSlug"
                type="text"
                value={draft.tenantSlug}
                onChange={(e) => handleChange('tenantSlug', e.target.value)}
                placeholder="your-business"
                spellCheck={false}
                autoComplete="off"
              />
              <FieldHint>Your subdomain / workspace identifier</FieldHint>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" variant="default">
                Save Settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTest()}
                disabled={
                  !draft.apiUrl || !draft.authToken || testStatus === 'testing'
                }
              >
                {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </Button>
              {testStatus === 'ok' && (
                <span className="text-sm font-semibold text-emerald-500">
                  ✓ Connected
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="text-sm font-semibold text-red-500">
                  ✗ Connection failed
                </span>
              )}
              {saved && testStatus === 'idle' && (
                <span className="text-sm font-semibold text-emerald-500">✓ Saved</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Current config preview */}
      {hasValues && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FieldRow label="API URL" value={draft.apiUrl || '—'} mono />
              <FieldRow
                label="Auth Token"
                value={draft.authToken ? '••••••••' + draft.authToken.slice(-4) : '—'}
                mono
              />
              <FieldRow label="Tenant Slug" value={draft.tenantSlug || '—'} mono />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={handleClear}
            >
              Clear All Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* MCP / agent connection configs */}
      {draft.apiUrl && draft.authToken && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Agent Connection (MCP)
            </span>
            <span className="text-xs text-muted-foreground">
              Connect any AI agent to your dashboard using the MCP protocol
            </span>
          </div>
          <ConnectPanel apiUrl={draft.apiUrl} authToken={draft.authToken} />
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground opacity-75">
        Settings are stored in your browser&apos;s localStorage and never sent to any
        server other than the API URL you configure above.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------
export function SettingsForm() {
  const [dev, setDev] = useState<DevSettings>({
    apiUrl: '',
    authToken: '',
    tenantSlug: '',
  })
  const [showDev, setShowDev] = useState(false)

  useEffect(() => {
    setDev({
      apiUrl: localStorage.getItem(STORAGE_KEYS.apiUrl) ?? '',
      authToken: localStorage.getItem(STORAGE_KEYS.authToken) ?? '',
      tenantSlug: localStorage.getItem(STORAGE_KEYS.tenantSlug) ?? '',
    })
  }, [])

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Tabs defaultValue="profile">
        <TabsList className="mb-6 flex w-full">
          <TabsTrigger value="profile" className="flex-1">
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex-1">
            Billing
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-1">
            Team Access
          </TabsTrigger>
          {showDev && (
            <TabsTrigger value="developer" className="flex-1">
              Developer
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <BusinessProfileTab dev={dev} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab dev={dev} />
        </TabsContent>

        <TabsContent value="team">
          <TeamAccessTab dev={dev} />
        </TabsContent>

        {showDev && (
          <TabsContent value="developer">
            <DeveloperTab dev={dev} onDevChange={setDev} />
          </TabsContent>
        )}
      </Tabs>

      {/* Toggle to reveal developer tab */}
      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowDev((v) => !v)}
          className="text-xs text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
        >
          {showDev ? 'Hide developer settings' : 'Show developer settings'}
        </button>
      </div>
    </div>
  )
}
