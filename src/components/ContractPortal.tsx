'use client'

import { useEffect, useState } from 'react'
import { ContractForm } from './ContractForm'

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

interface ContractPortalProps {
  /** Company name shown in error messages. Defaults to "us". */
  companyName?: string
}

type LoadState = 'loading' | 'not_found' | 'signed' | 'ready'

export function ContractPortal({ companyName = 'us' }: ContractPortalProps) {
  const [state, setState] = useState<LoadState>('loading')
  const [contract, setContract] = useState<ContractData | null>(null)
  const [trackUrl, setTrackUrl] = useState('')

  useEffect(() => {
    const parts = window.location.pathname.split('/')
    const reference = parts[parts.length - 1]

    if (!reference || reference === 'contract') {
      setState('not_found')
      return
    }

    fetch(`/api/contracts/${reference}`)
      .then(async (res) => {
        if (!res.ok) {
          setState('not_found')
          return
        }
        const data = (await res.json()) as { contract: ContractData }
        const c = data.contract

        const terminalStatuses = new Set(['signed', 'active', 'delivered', 'completed'])
        if (terminalStatuses.has(c.status)) {
          setTrackUrl(`/portal/track/${c.reference}`)
          setState('signed')
          return
        }

        setContract(c)
        setState('ready')
      })
      .catch(() => setState('not_found'))
  }, [])

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem', color: 'var(--ink-muted)' }}>
        <div className="spinner" aria-label="Loading..." />
        <p>Loading your contract...</p>
        <style>{`.spinner{width:36px;height:36px;border:3px solid var(--ink-border);border-top-color:var(--ink-primary);border-radius:50%;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Contract Not Found</h2>
        <p>This contract link may be invalid or expired. Please contact {companyName} for assistance.</p>
      </div>
    )
  }

  if (state === 'signed') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 1.5rem' }}>
          <circle cx="32" cy="32" r="32" fill="var(--ink-primary)" fillOpacity="0.15" />
          <circle cx="32" cy="32" r="28" stroke="var(--ink-primary)" strokeWidth="2" />
          <path d="M20 32l8 8 16-16" stroke="var(--ink-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '0.5rem' }}>Contract Signed</h2>
        <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>This contract has been signed. Track your shipment below.</p>
        <a
          href={trackUrl}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--ink-primary)', color: '#000', fontWeight: 700,
            fontSize: '0.9rem', padding: '0.625rem 1.5rem', borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          View Shipment Tracker
        </a>
      </div>
    )
  }

  if (state === 'ready' && contract) {
    return <ContractForm contract={contract} />
  }

  return null
}
