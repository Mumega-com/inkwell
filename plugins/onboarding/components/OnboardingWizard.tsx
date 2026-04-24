import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Input } from '../../../src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../src/components/ui/select'
import { Progress } from '../../../src/components/ui/progress'
import { Textarea } from '../../../src/components/ui/textarea'

// ---------------------------------------------------------------------------
// Storage keys (mirrors dashboard plugin convention)
// ---------------------------------------------------------------------------
const STORAGE_KEYS = {
  apiUrl: 'mumega_api_url',
  authToken: 'mumega_auth_token',
  tenantSlug: 'mumega_tenant_slug',
  onboarded: 'mumega_onboarded',
} as const

const TOTAL_STEPS = 5

const TEAMS = [
  { id: 'seo',      label: 'Marketing Team' },
  { id: 'content',  label: 'Content Writers' },
  { id: 'ops',      label: 'Tech Support' },
  { id: 'outreach', label: 'Outreach Team' },
] as const

type TeamId = (typeof TEAMS)[number]['id']

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div
        style={{ color: 'var(--ink-primary)' }}
        className="text-4xl font-bold"
      >
        ◉
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Welcome to Mumega
        </h2>
        <p style={{ color: 'var(--ink-muted)' }} className="text-sm">
          Let&apos;s set up your AI team in 2 minutes
        </p>
      </div>
      <Button
        onClick={onNext}
        size="lg"
        className="mt-2 w-full"
        style={{ background: 'var(--ink-primary)', color: '#000', fontWeight: 600 }}
      >
        Get Started
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Business Profile
// ---------------------------------------------------------------------------
function StepBusinessProfile({
  onNext,
}: {
  onNext: (data: { businessName: string; industry: string }) => void
}) {
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')

  useEffect(() => {
    const slug = localStorage.getItem(STORAGE_KEYS.tenantSlug) ?? ''
    if (slug) setBusinessName(slug)
  }, [])

  function handleNext() {
    if (!businessName.trim() || !industry) return
    onNext({ businessName: businessName.trim(), industry })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Business Profile
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Tell us about your business so we can personalize your experience.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="bizName"
          className="text-xs font-semibold"
          style={{ color: 'var(--ink-muted)' }}
        >
          Business Name
        </label>
        <Input
          id="bizName"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Your Business Name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="industry"
          className="text-xs font-semibold"
          style={{ color: 'var(--ink-muted)' }}
        >
          Industry
        </label>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger id="industry">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="technology">Technology</SelectItem>
            <SelectItem value="healthcare">Healthcare</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="real_estate">Real Estate</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleNext}
        disabled={!businessName.trim() || !industry}
        className="w-full"
        style={
          businessName.trim() && industry
            ? { background: 'var(--ink-primary)', color: '#000', fontWeight: 600 }
            : {}
        }
      >
        Next
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Connect Your AI
// ---------------------------------------------------------------------------
function StepConnectAI({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [mcpConfig, setMcpConfig] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const apiUrl = localStorage.getItem(STORAGE_KEYS.apiUrl) ?? ''
    const authToken = localStorage.getItem(STORAGE_KEYS.authToken) ?? ''

    if (!apiUrl || !authToken) {
      // Build a placeholder config from tenant slug
      const slug = localStorage.getItem(STORAGE_KEYS.tenantSlug) ?? 'your-tenant'
      const placeholder = JSON.stringify(
        { mcpServers: { inkwell: { url: `https://${slug}.mumega.com/mcp` } } },
        null,
        2
      )
      setMcpConfig(placeholder)
      setLoading(false)
      return
    }

    fetch(`${apiUrl}/my/connect`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const mcpUrl = typeof d.mcp_url === 'string' ? d.mcp_url : `${apiUrl}/mcp`
        setMcpConfig(
          JSON.stringify({ mcpServers: { inkwell: { url: mcpUrl } } }, null, 2)
        )
      })
      .catch(() => {
        setMcpConfig(JSON.stringify({ mcpServers: { inkwell: { url: `${apiUrl}/mcp` } } }, null, 2))
      })
      .finally(() => setLoading(false))
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(mcpConfig).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // no-op
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Connect Your AI
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Add this config to Claude Code, Cursor, or Claude Desktop to let your AI agent
          manage your dashboard.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Loading connection details…
        </p>
      ) : (
        <div
          className="flex flex-col overflow-hidden rounded-lg border"
          style={{ borderColor: 'var(--ink-border)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--ink-border)', background: 'var(--ink-surface)' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>
              MCP Config
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs"
              style={copied ? { borderColor: '#10B981', color: '#10B981' } : {}}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
          <pre
            className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed"
            style={{ background: 'rgba(0,0,0,0.25)', color: 'var(--ink-text)' }}
          >
            {mcpConfig}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={onNext}
          className="flex-1"
          style={{ background: 'var(--ink-primary)', color: '#000', fontWeight: 600 }}
        >
          Next
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm transition-opacity hover:opacity-100"
          style={{ color: 'var(--ink-muted)', opacity: 0.7 }}
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Choose Teams
// ---------------------------------------------------------------------------
function StepChooseTeams({
  onNext,
}: {
  onNext: (selected: TeamId[]) => void
}) {
  const [selected, setSelected] = useState<Set<TeamId>>(new Set())

  function toggle(id: TeamId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Choose Your Teams
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Which teams should work on your business?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {TEAMS.map((team) => {
          const isSelected = selected.has(team.id)
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => toggle(team.id)}
              className="flex items-center gap-3 rounded-lg border p-4 text-left transition-all"
              style={{
                borderColor: isSelected ? 'var(--ink-primary)' : 'var(--ink-border)',
                background: isSelected ? 'rgba(212,160,23,0.08)' : 'var(--ink-surface)',
                color: 'var(--ink-text)',
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs"
                style={{
                  borderColor: isSelected ? 'var(--ink-primary)' : 'var(--ink-border)',
                  background: isSelected ? 'var(--ink-primary)' : 'transparent',
                  color: isSelected ? '#000' : 'transparent',
                }}
              >
                ✓
              </span>
              <span className="text-sm font-medium">{team.label}</span>
            </button>
          )
        })}
      </div>

      <Button
        onClick={() => onNext([...selected])}
        className="w-full"
        style={{ background: 'var(--ink-primary)', color: '#000', fontWeight: 600 }}
      >
        Next
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — First Request
// ---------------------------------------------------------------------------
function StepFirstRequest({
  onStart,
  submitting,
}: {
  onStart: (request: string) => void
  submitting: boolean
}) {
  const [request, setRequest] = useState('')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Your First Request
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          What&apos;s the first thing you&apos;d like your team to do?
        </p>
      </div>

      <Textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="e.g. Write 3 blog posts about our services, audit our SEO, create a lead follow-up sequence…"
        rows={4}
      />

      <Button
        onClick={() => onStart(request.trim())}
        disabled={!request.trim() || submitting}
        className="w-full"
        style={
          request.trim() && !submitting
            ? { background: 'var(--ink-primary)', color: '#000', fontWeight: 600 }
            : {}
        }
      >
        {submitting ? 'Starting…' : 'Start Working'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root — OnboardingWizard
// ---------------------------------------------------------------------------
export function OnboardingWizard() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Collected data
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<TeamId[]>([])

  const progressPct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100)

  function handleProfileNext(data: { businessName: string; industry: string }) {
    setBusinessName(data.businessName)
    setIndustry(data.industry)
    setStep(3)
  }

  function handleTeamsNext(teams: TeamId[]) {
    setSelectedTeams(teams)
    setStep(5)
  }

  async function handleStart(firstRequest: string) {
    setSubmitting(true)
    try {
      const apiUrl = localStorage.getItem('mumega_api_url') ?? ''
      const authToken = localStorage.getItem('mumega_auth_token') ?? ''

      if (apiUrl && authToken) {
        // Create squads for selected teams
        for (const teamId of selectedTeams) {
          await fetch(`${apiUrl}/my/squads`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              squad_id: teamId,
              business_name: businessName,
              industry,
            }),
          }).catch(() => {
            // best-effort — don't block onboarding
          })
        }

        // Post the first task
        if (firstRequest) {
          await fetch(`${apiUrl}/my/tasks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: firstRequest,
              source: 'onboarding',
              teams: selectedTeams,
            }),
          }).catch(() => {
            // best-effort
          })
        }
      }
    } catch {
      // best-effort — complete onboarding regardless
    } finally {
      localStorage.setItem('mumega_onboarded', 'true')
      window.location.href = '/dashboard'
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--ink-bg)' }}
    >
      <div className="w-full max-w-[500px]">
        <Card style={{ background: 'var(--ink-surface)', borderColor: 'var(--ink-border)' }}>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3">
              {/* Step indicator */}
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold" style={{ color: 'var(--ink-muted)' }}>
                  Step {step} of {TOTAL_STEPS}
                </CardTitle>
                <span className="text-xs font-mono" style={{ color: 'var(--ink-dim)' }}>
                  {progressPct}%
                </span>
              </div>
              {/* Progress bar */}
              <Progress value={progressPct} className="h-1.5" />
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {step === 1 && (
              <StepWelcome onNext={() => setStep(2)} />
            )}
            {step === 2 && (
              <StepBusinessProfile onNext={handleProfileNext} />
            )}
            {step === 3 && (
              <StepConnectAI
                onNext={() => setStep(4)}
                onSkip={() => setStep(4)}
              />
            )}
            {step === 4 && (
              <StepChooseTeams onNext={handleTeamsNext} />
            )}
            {step === 5 && (
              <StepFirstRequest onStart={handleStart} submitting={submitting} />
            )}
          </CardContent>
        </Card>

        {/* Back link (not on step 1) */}
        {step > 1 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-xs transition-opacity hover:opacity-100"
              style={{ color: 'var(--ink-muted)', opacity: 0.6 }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
