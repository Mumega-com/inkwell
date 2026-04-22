'use client'

import { useState, useEffect } from 'react'
import { config } from '../../lib/config'

interface FeedbackProps {
  slug: string
}

export function Feedback({ slug }: FeedbackProps) {
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasVoted = localStorage.getItem(`ink-feedback-${slug}`)
      if (hasVoted) setVoted(true)
    }
  }, [slug])

  const submitFeedback = async (type: 'positive' | 'negative') => {
    setFeedbackType(type)
    setShowComment(true)
  }

  const sendFinalFeedback = async () => {
    setLoading(true)
    const apiUrl = config.workerUrl ? `${config.workerUrl}/api/feedback` : '/api/feedback'
    
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, type: feedbackType, text: comment }),
      })
      
      setVoted(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ink-feedback-${slug}`, 'true')
      }
    } catch (err) {
      console.error('Feedback failed:', err)
      // Still show success to user to not block flow
      setVoted(true)
    } finally {
      setLoading(false)
    }
  }

  if (voted) {
    return (
      <div className="feedback-container voted">
        <span className="feedback-thanks">Thank you for helping us improve!</span>
      </div>
    )
  }

  if (showComment) {
    return (
      <div className="feedback-container">
        <span className="feedback-label">Anything else you'd like to share? (Optional)</span>
        <textarea 
          className="feedback-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could we do better?"
          rows={3}
        />
        <div className="feedback-buttons">
          <button 
            onClick={sendFinalFeedback} 
            disabled={loading}
            className="feedback-btn submit"
          >
            {loading ? 'Sending...' : 'Send Feedback'}
          </button>
          <button 
            onClick={() => setVoted(true)} 
            className="feedback-btn skip"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="feedback-container">
      <span className="feedback-label">Was this helpful?</span>
      <div className="feedback-buttons">
        <button 
          onClick={() => submitFeedback('positive')} 
          disabled={loading}
          className="feedback-btn yes"
        >
          Yes
        </button>
        <button 
          onClick={() => submitFeedback('negative')} 
          disabled={loading}
          className="feedback-btn no"
        >
          No
        </button>
      </div>
    </div>
  )
}
