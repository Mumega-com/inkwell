'use client'

import { useState, useEffect } from 'react'

interface FeedbackProps {
  id: string
}

export function Feedback({ id }: FeedbackProps) {
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasVoted = localStorage.getItem(`ink-feedback-${id}`)
      if (hasVoted) setVoted(true)
    }
  }, [id])

  const submitFeedback = async (useful: boolean) => {
    setLoading(true)
    // Simulate API call to D1 feedback table
    setTimeout(() => {
      setVoted(true)
      setLoading(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ink-feedback-${id}`, 'true')
      }
    }, 600)
  }

  if (voted) {
    return (
      <div className="feedback-container voted">
        <span className="feedback-thanks">Thank you for your feedback!</span>
      </div>
    )
  }

  return (
    <div className="feedback-container">
      <span className="feedback-label">Was this helpful?</span>
      <div className="feedback-buttons">
        <button 
          onClick={() => submitFeedback(true)} 
          disabled={loading}
          className="feedback-btn yes"
        >
          {loading ? '...' : 'Yes'}
        </button>
        <button 
          onClick={() => submitFeedback(false)} 
          disabled={loading}
          className="feedback-btn no"
        >
          {loading ? '...' : 'No'}
        </button>
      </div>
    </div>
  )
}
