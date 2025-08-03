'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import BetaOnboarding from './BetaOnboarding'
import FeedbackWidget from './FeedbackWidget'

export default function BetaFeatures() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const { user, loading } = useAuth()

  useEffect(() => {
    // Only show onboarding for authenticated users who haven't completed it
    if (!loading && user) {
      const hasCompletedOnboarding = localStorage.getItem('voice-memory-onboarding-complete')
      if (!hasCompletedOnboarding) {
        // Small delay to let the page load
        setTimeout(() => {
          setShowOnboarding(true)
        }, 1000)
      }
      setShowFeedback(true)
    } else {
      setShowFeedback(false)
    }
  }, [user, loading])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  return (
    <>
      {/* Beta Onboarding Modal - Always rendered but conditionally visible */}
      <BetaOnboarding 
        onComplete={handleOnboardingComplete} 
        isVisible={showOnboarding}
      />
      
      {/* Feedback Widget - Always rendered but conditionally visible */}
      <FeedbackWidget isVisible={showFeedback} />
    </>
  )
}