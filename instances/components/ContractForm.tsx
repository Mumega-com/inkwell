'use client'

import { useState } from 'react'

interface ContractData {
  id: string
  reference: string
  status: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  vehicle_description: string | null
  origin: string | null
  destination: string | null
  service_type: string | null
  rate: number | null
  currency: string | null
  payment_terms: string | null
  service_inclusions: string | null
  insurance_type: string | null
  insurance_rate: number | null
  insurance_cost: number | null
  created_at: string
}

interface ContractFormProps {
  contract: ContractData
  apiBase?: string
}

const SERVICE_LABELS: Record<string, string> = {
  shared: 'Shared Container',
  container: 'Full Container',
  roro: 'Roll-On/Roll-Off (RoRo)',
}

const EXCLUSIONS = [
  'Terminal charges and customs clearance at the destination port are for the consignee\'s account unless otherwise stated.',
  'This quote does not include any import duties, taxes, or government levies at the destination country.',
  'Customer must be ready to ship within 5 business days of booking confirmation.',
  'Storage fees of $10 CAD/day apply after 5 days of vehicle being at the origin terminal.',
  'Vehicles stored for more than 30 days without pickup authorization will be deemed abandoned and may be auctioned to recover costs.',
  'Vehicle must be in running/driving condition at time of pickup. Non-running vehicles must be disclosed in advance.',
  'Salvage, scrap, flood-damaged, or accident-declared vehicles are not accepted.',
  'Customer is solely responsible for purchasing adequate marine cargo insurance. Viamar is not liable for loss or damage without insurance coverage.',
  'Personal effects, documents, or items left inside the vehicle are not covered and may be removed or confiscated at customs.',
  'Full payment is due within 10 business days of vessel loading date. Late payments are subject to a $15 CAD/day late fee.',
  'Vehicles with lithium batteries (EV, hybrid) must be declared prior to booking. Additional handling fees may apply.',
  'Leased or financed vehicles require written authorization from the lien holder prior to export.',
  'A minimum 2-week advance booking is required to guarantee vessel space and booking confirmation.',
  'All services are subject to the Canadian International Freight Forwarders Association (CIFFA) Standard Trading Conditions, available upon request.',
]

type InsuranceType = 'all_risk' | 'total_loss' | 'declined' | ''

export function ContractForm({ contract, apiBase = '' }: ContractFormProps) {
  const [insurance, setInsurance] = useState<InsuranceType>((contract.insurance_type as InsuranceType) || '')
  const [signatureName, setSignatureName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(contract.status === 'signed')

  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const serviceLabel = contract.service_type ? (SERVICE_LABELS[contract.service_type] ?? contract.service_type) : 'N/A'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!insurance) {
      setError('Please select an insurance option before signing.')
      return
    }
    if (!signatureName.trim()) {
      setError('Please type your full name to sign.')
      return
    }
    if (!agreed) {
      setError('You must agree to the terms and conditions.')
      return
    }

    setSubmitting(true)

    try {
      // Save insurance selection first
      const insRes = await fetch(`${apiBase}/api/contracts/${contract.reference}/insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insurance_type: insurance }),
      })
      if (!insRes.ok) {
        const d = await insRes.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to save insurance selection')
      }

      // Sign the contract
      const signRes = await fetch(`${apiBase}/api/contracts/${contract.reference}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_by: signatureName.trim() }),
      })
      if (!signRes.ok) {
        const d = await signRes.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to sign contract')
      }

      const data = await signRes.json() as { trackUrl?: string }
      setSigned(true)

      // Redirect to tracking page
      if (data.trackUrl) {
        window.location.href = data.trackUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (signed) {
    return (
      <div className="contract-signed">
        <div className="signed-icon" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="var(--ink-primary)" fillOpacity="0.15" />
            <circle cx="32" cy="32" r="28" stroke="var(--ink-primary)" strokeWidth="2" />
            <path d="M20 32l8 8 16-16" stroke="var(--ink-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2>Contract Signed</h2>
        <p>Your contract has been signed. Redirecting to your shipment tracker...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="contract-form">

      {/* Contract Details */}
      <section className="cf-section">
        <h2 className="cf-section-title">Shipment Details</h2>
        <div className="cf-grid">
          <div className="cf-field">
            <span className="cf-label">Reference</span>
            <span className="cf-value cf-mono">{contract.reference}</span>
          </div>
          <div className="cf-field">
            <span className="cf-label">Date</span>
            <span className="cf-value">{today}</span>
          </div>
          <div className="cf-field">
            <span className="cf-label">Customer</span>
            <span className="cf-value">{contract.customer_name}</span>
          </div>
          {contract.customer_email && (
            <div className="cf-field">
              <span className="cf-label">Email</span>
              <span className="cf-value">{contract.customer_email}</span>
            </div>
          )}
          {contract.customer_phone && (
            <div className="cf-field">
              <span className="cf-label">Phone</span>
              <span className="cf-value">{contract.customer_phone}</span>
            </div>
          )}
          {contract.vehicle_description && (
            <div className="cf-field cf-field--full">
              <span className="cf-label">Vehicle</span>
              <span className="cf-value">{contract.vehicle_description}</span>
            </div>
          )}
          {contract.origin && (
            <div className="cf-field">
              <span className="cf-label">Origin</span>
              <span className="cf-value">{contract.origin}</span>
            </div>
          )}
          {contract.destination && (
            <div className="cf-field">
              <span className="cf-label">Destination</span>
              <span className="cf-value">{contract.destination}</span>
            </div>
          )}
          <div className="cf-field">
            <span className="cf-label">Service Type</span>
            <span className="cf-value">{serviceLabel}</span>
          </div>
          {contract.rate != null && (
            <div className="cf-field">
              <span className="cf-label">Rate</span>
              <span className="cf-value cf-price">
                {contract.currency} {contract.rate.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {contract.payment_terms && (
            <div className="cf-field">
              <span className="cf-label">Payment Terms</span>
              <span className="cf-value">{contract.payment_terms}</span>
            </div>
          )}
          {contract.service_inclusions && (
            <div className="cf-field cf-field--full">
              <span className="cf-label">Service Inclusions</span>
              <span className="cf-value">{contract.service_inclusions}</span>
            </div>
          )}
        </div>
        <p className="cf-validity">This quote is valid for <strong>30 days</strong> from the date above.</p>
      </section>

      {/* Insurance Selection */}
      <section className="cf-section">
        <h2 className="cf-section-title">Insurance Selection</h2>
        <p className="cf-help">Select your preferred insurance coverage. Viamar strongly recommends All Risk coverage for international shipments.</p>

        <div className="cf-insurance-options">
          <label className={`cf-insurance-option ${insurance === 'all_risk' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="insurance"
              value="all_risk"
              checked={insurance === 'all_risk'}
              onChange={() => setInsurance('all_risk')}
            />
            <div className="cf-insurance-content">
              <strong>All Risk</strong>
              <span>Comprehensive coverage — percentage of vehicle value, USD $1,000 deductible. Covers physical damage, theft, and total loss.</span>
            </div>
          </label>

          <label className={`cf-insurance-option ${insurance === 'total_loss' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="insurance"
              value="total_loss"
              checked={insurance === 'total_loss'}
              onChange={() => setInsurance('total_loss')}
            />
            <div className="cf-insurance-content">
              <strong>Total Loss Only</strong>
              <span>Covers complete loss of the vehicle only — percentage of vehicle value. Does not cover partial damage.</span>
            </div>
          </label>

          <label className={`cf-insurance-option cf-insurance-option--warning ${insurance === 'declined' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="insurance"
              value="declined"
              checked={insurance === 'declined'}
              onChange={() => setInsurance('declined')}
            />
            <div className="cf-insurance-content">
              <strong>Decline Insurance</strong>
              <span>I understand I am shipping without insurance coverage and assume all risk of loss or damage.</span>
            </div>
          </label>
        </div>
      </section>

      {/* Terms & Conditions */}
      <section className="cf-section">
        <h2 className="cf-section-title">Terms &amp; Conditions</h2>
        <p className="cf-help">Please read the following terms carefully before signing.</p>

        <div className="cf-terms-scroll" role="region" aria-label="Terms and conditions">
          <ol className="cf-exclusions">
            {EXCLUSIONS.map((clause, i) => (
              <li key={i}>{clause}</li>
            ))}
          </ol>
        </div>
      </section>

      {/* E-Signature */}
      <section className="cf-section">
        <h2 className="cf-section-title">Electronic Signature</h2>
        <p className="cf-help">
          By typing your full name below and clicking "Sign Contract", you agree that this constitutes a legal electronic signature
          under applicable law and that you have read and accept all terms above.
        </p>

        <div className="cf-sig-fields">
          <div className="cf-sig-field">
            <label htmlFor="sig-name" className="cf-sig-label">Full Name (typed signature)</label>
            <input
              id="sig-name"
              type="text"
              className="cf-sig-input"
              placeholder="Type your full legal name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="cf-sig-field">
            <label className="cf-sig-label">Date</label>
            <div className="cf-sig-date">{today}</div>
          </div>
        </div>

        <label className="cf-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          <span>I have read and agree to all terms and conditions above. I understand this is a binding agreement.</span>
        </label>
      </section>

      {error && (
        <div className="cf-error" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="cf-submit"
        disabled={submitting || !insurance || !signatureName.trim() || !agreed}
      >
        {submitting ? 'Signing...' : 'Sign Contract'}
      </button>

      <style>{`
        .contract-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .contract-signed {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 1rem;
          text-align: center;
        }

        .contract-signed h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ink-primary);
          margin: 0;
        }

        .contract-signed p {
          color: var(--ink-muted);
          margin: 0;
        }

        .cf-section {
          background: var(--ink-surface);
          border: 1px solid var(--ink-border);
          border-radius: 10px;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .cf-section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-muted);
          margin: 0;
        }

        .cf-help {
          font-size: 0.875rem;
          color: var(--ink-muted);
          margin: 0;
          line-height: 1.6;
        }

        .cf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem 1.5rem;
        }

        .cf-field {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .cf-field--full {
          grid-column: 1 / -1;
        }

        .cf-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-dim);
        }

        .cf-value {
          font-size: 0.95rem;
          color: var(--ink-text);
          line-height: 1.5;
        }

        .cf-mono {
          font-family: var(--ink-font-mono, monospace);
          color: var(--ink-secondary);
          font-size: 0.9rem;
        }

        .cf-price {
          font-weight: 700;
          color: var(--ink-primary);
          font-size: 1.05rem;
        }

        .cf-validity {
          font-size: 0.82rem;
          color: var(--ink-dim);
          margin: 0;
          border-top: 1px solid var(--ink-border);
          padding-top: 0.75rem;
        }

        .cf-validity strong {
          color: var(--ink-text);
        }

        .cf-insurance-options {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .cf-insurance-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid var(--ink-border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }

        .cf-insurance-option:hover {
          border-color: var(--ink-primary);
        }

        .cf-insurance-option.selected {
          border-color: var(--ink-primary);
          background: color-mix(in srgb, var(--ink-primary) 8%, transparent);
        }

        .cf-insurance-option--warning.selected {
          border-color: #f59e0b;
          background: color-mix(in srgb, #f59e0b 8%, transparent);
        }

        .cf-insurance-option input[type="radio"] {
          margin-top: 0.15rem;
          accent-color: var(--ink-primary);
          flex-shrink: 0;
        }

        .cf-insurance-content {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .cf-insurance-content strong {
          font-size: 0.9rem;
          color: var(--ink-text);
        }

        .cf-insurance-content span {
          font-size: 0.82rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .cf-terms-scroll {
          max-height: 280px;
          overflow-y: auto;
          border: 1px solid var(--ink-border);
          border-radius: 6px;
          padding: 1rem 1.25rem;
          background: var(--ink-bg);
        }

        .cf-exclusions {
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .cf-exclusions li {
          font-size: 0.83rem;
          color: var(--ink-muted);
          line-height: 1.6;
        }

        .cf-sig-fields {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 1rem;
          align-items: end;
        }

        .cf-sig-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .cf-sig-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-dim);
        }

        .cf-sig-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          background: var(--ink-bg);
          border: 1px solid var(--ink-border);
          border-radius: 6px;
          color: var(--ink-text);
          font-size: 1rem;
          font-family: Georgia, 'Times New Roman', serif;
          transition: border-color 0.15s;
          outline: none;
          box-sizing: border-box;
        }

        .cf-sig-input::placeholder {
          color: var(--ink-dim);
          font-family: inherit;
        }

        .cf-sig-input:focus {
          border-color: var(--ink-primary);
        }

        .cf-sig-date {
          padding: 0.625rem 0.875rem;
          background: var(--ink-bg);
          border: 1px solid var(--ink-border);
          border-radius: 6px;
          color: var(--ink-muted);
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .cf-agree {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .cf-agree input[type="checkbox"] {
          margin-top: 0.15rem;
          accent-color: var(--ink-primary);
          flex-shrink: 0;
        }

        .cf-error {
          padding: 0.75rem 1rem;
          background: color-mix(in srgb, #ef4444 12%, transparent);
          border: 1px solid color-mix(in srgb, #ef4444 40%, transparent);
          border-radius: 6px;
          color: #fca5a5;
          font-size: 0.875rem;
        }

        .cf-submit {
          padding: 0.875rem 2rem;
          background: var(--ink-primary);
          color: #000;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.15s;
          align-self: flex-start;
        }

        .cf-submit:hover:not(:disabled) {
          opacity: 0.88;
        }

        .cf-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        @media (max-width: 560px) {
          .cf-section {
            padding: 1.25rem;
          }

          .cf-sig-fields {
            grid-template-columns: 1fr;
          }

          .cf-submit {
            align-self: stretch;
          }
        }
      `}</style>
    </form>
  )
}
