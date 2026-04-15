'use client'

import { useState } from 'react'

interface MovingQuoteFormProps {
  apiBase?: string
}

type MoveSize = 'small' | 'medium' | 'large' | 'full_house'
type ServiceType = 'shared_ltl' | 'dedicated'

interface FormState {
  full_name: string
  phone: string
  email: string
  service_type: ServiceType | ''
  origin_city: string
  destination_city: string
  move_size: MoveSize | ''
  estimated_pallets: string
  additional_details: string
}

const MOVE_SIZE_LABELS: Record<MoveSize, string> = {
  small: 'Small Move',
  medium: 'Medium Move',
  large: 'Large Move',
  full_house: 'Full House',
}

const PALLET_ESTIMATES: Record<MoveSize, string> = {
  small: '~0.5 pallet',
  medium: '~1–2 pallets',
  large: '~2–3 pallets',
  full_house: '4+ pallets',
}

export function MovingQuoteForm({ apiBase = '' }: MovingQuoteFormProps) {
  const [form, setForm] = useState<FormState>({
    full_name: '',
    phone: '',
    email: '',
    service_type: '',
    origin_city: '',
    destination_city: '',
    move_size: '',
    estimated_pallets: '',
    additional_details: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-populate pallet estimate when move size changes
  function handleMoveSizeChange(size: MoveSize) {
    const palletMap: Record<MoveSize, string> = {
      small: '0.5',
      medium: '1',
      large: '2',
      full_house: '4',
    }
    setForm((prev) => ({
      ...prev,
      move_size: size,
      estimated_pallets: prev.estimated_pallets || palletMap[size],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.full_name.trim()) { setError('Please enter your full name.'); return }
    if (!form.phone.trim()) { setError('Please enter your phone number.'); return }
    if (!form.email.trim()) { setError('Please enter your email.'); return }
    if (!form.service_type) { setError('Please select a service type.'); return }
    if (!form.origin_city.trim()) { setError('Please enter your origin city.'); return }
    if (!form.destination_city.trim()) { setError('Please enter your destination city.'); return }
    if (!form.move_size) { setError('Please select a move size.'); return }

    setSubmitting(true)

    try {
      const serviceLabel = form.service_type === 'shared_ltl' ? 'Shared LTL' : 'Dedicated Truck'
      const moveSizeLabel = MOVE_SIZE_LABELS[form.move_size as MoveSize] ?? form.move_size

      const payload = {
        customer_name: form.full_name,
        customer_phone: form.phone,
        customer_email: form.email,
        service_type: 'domestic_moving',
        origin: form.origin_city,
        destination: form.destination_city,
        vehicle_description: `Domestic Move — ${moveSizeLabel} (${serviceLabel}) — Est. ${form.estimated_pallets} pallets`,
        payment_terms: serviceLabel,
        service_inclusions: form.additional_details || null,
      }

      const res = await fetch(`${apiBase}/api/contracts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }

      const data = await res.json() as { reference?: string }
      setReference(data.reference ?? null)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mq-success">
        <div className="mq-success-icon">✓</div>
        <h3>Quote request received!</h3>
        {reference && (
          <p className="mq-ref">Reference: <strong>{reference}</strong></p>
        )}
        <p>Our team will review your details and be in touch within 1 business day with a personalized quote.</p>
        <p className="mq-success-sub">Questions? Call us at <a href="tel:18002777570">1-800-277-7570</a></p>
      </div>
    )
  }

  return (
    <form className="mq-form" onSubmit={handleSubmit} noValidate>
      <div className="mq-grid mq-grid-2">
        <div className="mq-field">
          <label htmlFor="mq-name">Full Name *</label>
          <input
            id="mq-name"
            type="text"
            placeholder="John Smith"
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            required
          />
        </div>
        <div className="mq-field">
          <label htmlFor="mq-phone">Phone *</label>
          <input
            id="mq-phone"
            type="tel"
            placeholder="+1 (416) 555-0100"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="mq-field">
        <label htmlFor="mq-email">Email *</label>
        <input
          id="mq-email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />
      </div>

      <div className="mq-field">
        <label>Service Type *</label>
        <div className="mq-radio-group">
          {(['shared_ltl', 'dedicated'] as const).map((type) => (
            <label key={type} className={`mq-radio-card${form.service_type === type ? ' mq-radio-card--active' : ''}`}>
              <input
                type="radio"
                name="service_type"
                value={type}
                checked={form.service_type === type}
                onChange={() => set('service_type', type)}
              />
              <span className="mq-radio-title">
                {type === 'shared_ltl' ? 'Shared / LTL' : 'Dedicated Truck'}
              </span>
              <span className="mq-radio-sub">
                {type === 'shared_ltl' ? 'Best for smaller moves — shared space, scheduled transit' : 'Direct service for full household moves'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mq-grid mq-grid-2">
        <div className="mq-field">
          <label htmlFor="mq-origin">Origin City *</label>
          <input
            id="mq-origin"
            type="text"
            placeholder="Toronto, ON"
            value={form.origin_city}
            onChange={(e) => set('origin_city', e.target.value)}
            required
          />
        </div>
        <div className="mq-field">
          <label htmlFor="mq-destination">Destination City *</label>
          <input
            id="mq-destination"
            type="text"
            placeholder="Calgary, AB"
            value={form.destination_city}
            onChange={(e) => set('destination_city', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="mq-field">
        <label>Move Size *</label>
        <div className="mq-size-grid">
          {(['small', 'medium', 'large', 'full_house'] as MoveSize[]).map((size) => (
            <button
              key={size}
              type="button"
              className={`mq-size-card${form.move_size === size ? ' mq-size-card--active' : ''}`}
              onClick={() => handleMoveSizeChange(size)}
            >
              <span className="mq-size-name">{MOVE_SIZE_LABELS[size]}</span>
              <span className="mq-size-pallets">{PALLET_ESTIMATES[size]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mq-field">
        <label htmlFor="mq-pallets">Estimated Pallets</label>
        <input
          id="mq-pallets"
          type="text"
          placeholder="e.g. 2"
          value={form.estimated_pallets}
          onChange={(e) => set('estimated_pallets', e.target.value)}
        />
        <span className="mq-hint">1 pallet ≈ 48"×40"×48" (150 cu ft)</span>
      </div>

      <div className="mq-field">
        <label htmlFor="mq-details">Additional Details</label>
        <textarea
          id="mq-details"
          rows={3}
          placeholder="Fragile items, special requirements, preferred pickup date, access restrictions..."
          value={form.additional_details}
          onChange={(e) => set('additional_details', e.target.value)}
        />
      </div>

      {error && <p className="mq-error" role="alert">{error}</p>}

      <button type="submit" className="mq-submit" disabled={submitting}>
        {submitting ? 'Sending...' : 'Request a Quote'}
      </button>

      <p className="mq-legal">
        By submitting you agree to be contacted by Viamar regarding your moving quote.
        We respect your privacy and won't share your information.
      </p>
    </form>
  )
}
