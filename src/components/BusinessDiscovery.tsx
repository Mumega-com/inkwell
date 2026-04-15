import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Answers {
  // Section 1
  business_name: string
  industry: string
  years_in_business: string
  team_size: string
  monthly_revenue: string
  // Section 2
  has_website: string
  website_platform: string
  google_business_profile: string
  social_media: string[]
  paid_ads: string
  has_crm: string
  // Section 3
  can_write_content: string
  can_record_video: string
  understands_analytics: string
  can_manage_social: string
  marketing_budget: string
  biggest_challenge: string
  // Section 4
  primary_goal: string
  timeline: string
  ideal_customer: string
  differentiator: string
  how_customers_find_you: string[]
}

interface Props {
  apiBase?: string
  redirectBase?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'inkwell_discovery_answers'

function loadSaved(): Partial<Answers> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Answers>) : {}
  } catch {
    return {}
  }
}

function opts(...pairs: [string, string][]): { value: string; label: string }[] {
  return pairs.map(([value, label]) => ({ value, label }))
}

function save(answers: Partial<Answers>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  } catch {
    // ignore storage errors
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionCard({
  value,
  label,
  selected,
  onClick,
}: {
  value: string
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '0.75rem 1rem',
        marginBottom: '0.5rem',
        background: selected ? 'rgba(212,160,23,0.12)' : 'var(--ink-surface)',
        border: selected ? '1.5px solid var(--ink-primary)' : '1.5px solid var(--ink-border)',
        borderRadius: '0.5rem',
        color: selected ? 'var(--ink-primary)' : 'var(--ink-text)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
      }}
    >
      {selected && <span style={{ marginRight: '0.5rem', color: 'var(--ink-primary)' }}>✓</span>}
      {label}
    </button>
  )
}

function CheckboxCard({
  value,
  label,
  checked,
  onToggle,
}: {
  value: string
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.9rem',
        marginRight: '0.5rem',
        marginBottom: '0.5rem',
        background: checked ? 'rgba(212,160,23,0.12)' : 'var(--ink-surface)',
        border: checked ? '1.5px solid var(--ink-primary)' : '1.5px solid var(--ink-border)',
        borderRadius: '2rem',
        color: checked ? 'var(--ink-primary)' : 'var(--ink-text)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '0.2rem',
          background: checked ? 'var(--ink-primary)' : 'transparent',
          border: checked ? '1.5px solid var(--ink-primary)' : '1.5px solid var(--ink-border)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6rem',
          color: '#000',
          flexShrink: 0,
        }}
      >
        {checked && '✓'}
      </span>
      {label}
    </button>
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength: number
}) {
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'var(--ink-surface)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: '0.5rem',
          color: 'var(--ink-text)',
          fontSize: '0.95rem',
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '0.5rem',
          right: '0.75rem',
          fontSize: '0.75rem',
          color: 'var(--ink-muted)',
        }}
      >
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BusinessDiscovery({ apiBase = '', redirectBase = '' }: Props) {
  const [step, setStep] = useState(0) // 0-3 = sections, 4 = loading, 5 = error
  const [answers, setAnswers] = useState<Partial<Answers>>(loadSaved)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    save(next)
  }

  function toggleMulti(key: 'social_media' | 'how_customers_find_you', value: string) {
    const current = (answers[key] as string[] | undefined) ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    set(key, next)
  }

  function select(key: keyof Answers, value: string) {
    set(key as 'industry', value as never)
  }

  function isSelected(key: keyof Answers, value: string) {
    return answers[key] === value
  }

  function isChecked(key: 'social_media' | 'how_customers_find_you', value: string) {
    const arr = (answers[key] as string[] | undefined) ?? []
    return arr.includes(value)
  }

  function canProceed(): boolean {
    if (step === 0) {
      return !!(
        answers.business_name?.trim() &&
        answers.industry &&
        answers.years_in_business &&
        answers.team_size &&
        answers.monthly_revenue
      )
    }
    if (step === 1) {
      return !!(
        answers.has_website &&
        answers.google_business_profile &&
        answers.paid_ads &&
        answers.has_crm
      )
    }
    if (step === 2) {
      return !!(
        answers.can_write_content &&
        answers.can_record_video &&
        answers.understands_analytics &&
        answers.can_manage_social &&
        answers.marketing_budget
      )
    }
    if (step === 3) {
      return !!(
        answers.primary_goal &&
        answers.timeline
      )
    }
    return false
  }

  async function handleSubmit() {
    setStep(4) // loading
    setError(null)

    // Ensure arrays are not undefined
    const payload: Answers = {
      business_name: answers.business_name ?? '',
      industry: answers.industry ?? '',
      years_in_business: answers.years_in_business ?? '',
      team_size: answers.team_size ?? '',
      monthly_revenue: answers.monthly_revenue ?? '',
      has_website: answers.has_website ?? '',
      website_platform: answers.website_platform ?? '',
      google_business_profile: answers.google_business_profile ?? '',
      social_media: answers.social_media ?? [],
      paid_ads: answers.paid_ads ?? '',
      has_crm: answers.has_crm ?? '',
      can_write_content: answers.can_write_content ?? '',
      can_record_video: answers.can_record_video ?? '',
      understands_analytics: answers.understands_analytics ?? '',
      can_manage_social: answers.can_manage_social ?? '',
      marketing_budget: answers.marketing_budget ?? '',
      biggest_challenge: answers.biggest_challenge ?? '',
      primary_goal: answers.primary_goal ?? '',
      timeline: answers.timeline ?? '',
      ideal_customer: answers.ideal_customer ?? '',
      differentiator: answers.differentiator ?? '',
      how_customers_find_you: answers.how_customers_find_you ?? [],
    }

    try {
      const res = await fetch(`${apiBase}/api/discovery/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { planId: string }
      localStorage.removeItem(STORAGE_KEY)
      window.location.href = `${redirectBase}/plan/${data.planId}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep(3)
    }
  }

  const sections = ['Your Business', 'Digital Presence', 'Skills & Resources', 'Your Goals']

  // ── Render ─────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '0 1rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'var(--ink-text)',
    fontSize: '1rem',
    fontWeight: 600,
  }

  const questionBlock: React.CSSProperties = {
    marginBottom: '1.75rem',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'var(--ink-surface)',
    border: '1.5px solid var(--ink-border)',
    borderRadius: '0.5rem',
    color: 'var(--ink-text)',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    outline: 'none',
  }

  if (step === 4) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙</span>
        </div>
        <h2 style={{ color: 'var(--ink-text)', marginBottom: '0.75rem', fontSize: '1.5rem' }}>
          Building your personalized plan...
        </h2>
        <p style={{ color: 'var(--ink-muted)' }}>
          Analyzing your answers and generating a 90-day roadmap just for {answers.business_name ?? 'your business'}.
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Progress bar */}
      <div
        style={{
          height: '4px',
          background: 'var(--ink-border)',
          borderRadius: '2px',
          marginBottom: '2rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((step + 1) / 4) * 100}%`,
            background: 'linear-gradient(to right, var(--ink-primary), var(--ink-secondary))',
            transition: 'width 0.3s ease',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Step indicator */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          justifyContent: 'center',
        }}
      >
        {sections.map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.3rem',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                background: i < step ? 'var(--ink-primary)' : i === step ? 'rgba(212,160,23,0.2)' : 'var(--ink-surface)',
                border: i === step ? '2px solid var(--ink-primary)' : i < step ? 'none' : '2px solid var(--ink-border)',
                color: i < step ? '#000' : i === step ? 'var(--ink-primary)' : 'var(--ink-muted)',
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span
              style={{
                fontSize: '0.65rem',
                color: i === step ? 'var(--ink-primary)' : 'var(--ink-dim)',
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Section heading */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--ink-text)', fontSize: '1.4rem', marginBottom: '0.25rem' }}>
          {step === 0 && 'Tell us about your business'}
          {step === 1 && "What's your digital presence like?"}
          {step === 2 && 'What can you do?'}
          {step === 3 && "What do you want to achieve?"}
        </h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
          {step === 0 && 'Start with the basics — we\'ll tailor everything from here.'}
          {step === 1 && 'Be honest. There are no wrong answers — gaps just become priorities.'}
          {step === 2 && 'Your skills determine the fastest path forward.'}
          {step === 3 && 'Your goal shapes your entire 90-day roadmap.'}
        </p>
      </div>

      {/* ── Section 1 ── */}
      {step === 0 && (
        <div>
          <div style={questionBlock}>
            <label style={labelStyle}>What&apos;s your business name?</label>
            <input
              type="text"
              value={answers.business_name ?? ''}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="e.g. Maple Leaf Logistics"
              style={inputStyle}
            />
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>What industry are you in?</label>
            {opts(
              ['freight_logistics', 'Freight / Logistics'],
              ['professional_services', 'Professional Services'],
              ['retail_ecommerce', 'Retail / E-commerce'],
              ['construction_trades', 'Construction / Trades'],
              ['food_restaurant', 'Food / Restaurant'],
              ['healthcare', 'Healthcare'],
              ['real_estate', 'Real Estate'],
              ['technology', 'Technology'],
              ['manufacturing', 'Manufacturing'],
              ['other', 'Other'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('industry', value)}
                onClick={() => select('industry', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>How many years have you been in business?</label>
            {opts(
              ['0_1', '0-1 years (just getting started)'],
              ['1_3', '1-3 years (finding my footing)'],
              ['3_10', '3-10 years (established and growing)'],
              ['10_plus', '10+ years (seasoned operator)'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('years_in_business', value)}
                onClick={() => select('years_in_business', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Team size?</label>
            {opts(
              ['just_me', 'Just me'],
              ['2_5', '2-5 people'],
              ['6_20', '6-20 people'],
              ['20_plus', '20+ people'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('team_size', value)}
                onClick={() => select('team_size', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Monthly revenue range?</label>
            {opts(
              ['pre_revenue', 'Pre-revenue (not yet making money)'],
              ['under_10k', 'Under $10K/mo'],
              ['10k_50k', '$10K-$50K/mo'],
              ['50k_200k', '$50K-$200K/mo'],
              ['200k_plus', '$200K+/mo'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('monthly_revenue', value)}
                onClick={() => select('monthly_revenue', value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2 ── */}
      {step === 1 && (
        <div>
          <div style={questionBlock}>
            <label style={labelStyle}>Do you have a website?</label>
            {opts(
              ['no', 'No website'],
              ['yes_basic', 'Yes — basic (just info, no SEO)'],
              ['yes_seo', 'Yes — with SEO optimization'],
              ['yes_ecommerce', 'Yes — with e-commerce'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('has_website', value)}
                onClick={() => select('has_website', value)}
              />
            ))}
          </div>

          {answers.has_website && answers.has_website !== 'no' && (
            <div style={questionBlock}>
              <label style={labelStyle}>What platform is your website on?</label>
              {opts(
                ['wordpress', 'WordPress'],
                ['shopify', 'Shopify'],
                ['wix', 'Wix'],
                ['squarespace', 'Squarespace'],
                ['custom', 'Custom / Developer built'],
                ['dont_know', "Don't know"],
              ).map(({ value, label }) => (
                <OptionCard
                  key={value}
                  value={value}
                  label={label}
                  selected={isSelected('website_platform', value)}
                  onClick={() => select('website_platform', value)}
                />
              ))}
            </div>
          )}

          <div style={questionBlock}>
            <label style={labelStyle}>Do you have a Google Business Profile?</label>
            {opts(
              ['no', 'No'],
              ['yes_not_optimized', 'Yes — but not fully set up'],
              ['yes_optimized', 'Yes — complete with photos and reviews'],
              ['dont_know', "Don't know what that is"],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('google_business_profile', value)}
                onClick={() => select('google_business_profile', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Which social media are you active on?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0' }}>
              {(['None', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'X'].map((s) => (
                <CheckboxCard
                  key={s}
                  value={s.toLowerCase()}
                  label={s}
                  checked={isChecked('social_media', s.toLowerCase())}
                  onToggle={() => toggleMulti('social_media', s.toLowerCase())}
                />
              )))}
            </div>
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Do you run paid ads?</label>
            {opts(
              ['no', 'No'],
              ['tried_and_stopped', 'Tried it and stopped'],
              ['currently_running', 'Currently running ads'],
              ['want_to_start', 'Want to start but haven\'t'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('paid_ads', value)}
                onClick={() => select('paid_ads', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Do you use a CRM (customer tracking tool)?</label>
            {opts(
              ['no', 'No — I track customers in my head'],
              ['spreadsheet', 'Spreadsheet / manual list'],
              ['ghl', 'GoHighLevel (GHL)'],
              ['hubspot', 'HubSpot'],
              ['salesforce', 'Salesforce'],
              ['other', 'Other CRM'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('has_crm', value)}
                onClick={() => select('has_crm', value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3 ── */}
      {step === 2 && (
        <div>
          <div style={questionBlock}>
            <label style={labelStyle}>Can you write content for your business?</label>
            {opts(
              ['no', 'No — writing is not my thing'],
              ['sometimes', 'Sometimes — when I find the time'],
              ['yes_regularly', 'Yes — I write regularly and enjoy it'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('can_write_content', value)}
                onClick={() => select('can_write_content', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Can you record video for your business?</label>
            {opts(
              ['never_tried', "Never tried — seems intimidating"],
              ['basic', 'I can do basic phone videos'],
              ['comfortable', 'Comfortable on camera'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('can_record_video', value)}
                onClick={() => select('can_record_video', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Do you understand your website analytics (Google Analytics)?</label>
            {opts(
              ['whats_that', "What's Google Analytics?"],
              ['ive_looked', "I've opened it once or twice"],
              ['check_weekly', 'I check it weekly'],
              ['make_decisions', 'I make business decisions from data'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('understands_analytics', value)}
                onClick={() => select('understands_analytics', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Can you manage social media consistently?</label>
            {opts(
              ['no_time', "No time — it always gets pushed aside"],
              ['occasionally', 'Post occasionally when I remember'],
              ['consistent', 'I keep a consistent schedule'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('can_manage_social', value)}
                onClick={() => select('can_manage_social', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>What&apos;s your monthly marketing budget?</label>
            {opts(
              ['zero', '$0 — organic only'],
              ['under_500', 'Under $500/mo'],
              ['500_2000', '$500-$2,000/mo'],
              ['2000_plus', '$2,000+/mo'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('marketing_budget', value)}
                onClick={() => select('marketing_budget', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>What&apos;s your biggest marketing challenge right now?</label>
            <TextArea
              value={answers.biggest_challenge ?? ''}
              onChange={(v) => set('biggest_challenge', v)}
              placeholder="e.g. I don't know where my customers come from. I can't afford to waste money on ads that don't work."
              maxLength={200}
            />
          </div>
        </div>
      )}

      {/* ── Section 4 ── */}
      {step === 3 && (
        <div>
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.5rem',
                color: '#f87171',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={questionBlock}>
            <label style={labelStyle}>What&apos;s your #1 goal right now?</label>
            {opts(
              ['more_leads', 'More leads — fill my pipeline'],
              ['more_sales', 'More sales — convert leads I already have'],
              ['brand_awareness', 'Brand awareness — more people should know me'],
              ['launch_product', 'Launch a new product or service'],
              ['new_market', 'Enter a new market or location'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('primary_goal', value)}
                onClick={() => select('primary_goal', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>How quickly do you need results?</label>
            {opts(
              ['this_month', 'This month — I need it now'],
              ['3_months', '3 months — steady progress'],
              ['6_months', '6 months — building momentum'],
              ['long_term', 'Long-term — building something that lasts'],
            ).map(({ value, label }) => (
              <OptionCard
                key={value}
                value={value}
                label={label}
                selected={isSelected('timeline', value)}
                onClick={() => select('timeline', value)}
              />
            ))}
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>Who is your ideal customer?</label>
            <TextArea
              value={answers.ideal_customer ?? ''}
              onChange={(v) => set('ideal_customer', v)}
              placeholder="e.g. Small trucking companies in Ontario with 5-20 trucks who ship cross-border..."
              maxLength={200}
            />
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>What makes you different from competitors?</label>
            <TextArea
              value={answers.differentiator ?? ''}
              onChange={(v) => set('differentiator', v)}
              placeholder="e.g. We specialize in fragile goods. Every shipment is packed by our own team, not outsourced..."
              maxLength={200}
            />
          </div>

          <div style={questionBlock}>
            <label style={labelStyle}>How do customers find you today?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {opts(
                ['word_of_mouth', 'Word of mouth'],
                ['google_search', 'Google search'],
                ['social_media', 'Social media'],
                ['ads', 'Paid ads'],
                ['referrals', 'Referrals'],
                ['walk_ins', 'Walk-ins'],
                ['cold_outreach', 'Cold outreach'],
                ['other', 'Other'],
              ).map(({ value, label }) => (
                <CheckboxCard
                  key={value}
                  value={value}
                  label={label}
                  checked={isChecked('how_customers_find_you', value)}
                  onToggle={() => toggleMulti('how_customers_find_you', value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--ink-border)',
          gap: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            border: '1.5px solid var(--ink-border)',
            borderRadius: '0.5rem',
            color: step === 0 ? 'var(--ink-dim)' : 'var(--ink-text)',
            cursor: step === 0 ? 'default' : 'pointer',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            opacity: step === 0 ? 0.4 : 1,
          }}
        >
          ← Back
        </button>

        <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
          {step + 1} of 4
        </span>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: '0.75rem 1.75rem',
              background: canProceed() ? 'var(--ink-primary)' : 'var(--ink-surface)',
              border: 'none',
              borderRadius: '0.5rem',
              color: canProceed() ? '#000' : 'var(--ink-dim)',
              cursor: canProceed() ? 'pointer' : 'default',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed()}
            style={{
              padding: '0.75rem 2rem',
              background: canProceed() ? 'var(--ink-primary)' : 'var(--ink-surface)',
              border: 'none',
              borderRadius: '0.5rem',
              color: canProceed() ? '#000' : 'var(--ink-dim)',
              cursor: canProceed() ? 'pointer' : 'default',
              fontSize: '0.95rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            Generate My Plan →
          </button>
        )}
      </div>
    </div>
  )
}
