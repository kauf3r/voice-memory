'use client'

import { useState, useEffect } from 'react'
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer'
import AnalysisView from './AnalysisView'
import LoadingSpinner from './LoadingSpinner'
import { NoteAnalysis } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface LazyAnalysisViewProps {
  noteId: string
  analysis: NoteAnalysis | null
  transcription?: string
  className?: string
}

export default function LazyAnalysisView({ 
  noteId, 
  analysis, 
  transcription,
  className = '' 
}: LazyAnalysisViewProps) {
  const [loadedAnalysis, setLoadedAnalysis] = useState<NoteAnalysis | null>(analysis)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { elementRef, hasIntersected } = useIntersectionObserver({
    triggerOnce: true,
    rootMargin: '200px',
  })

  useEffect(() => {
    console.log(`LazyAnalysisView effect - noteId: ${noteId}, hasAnalysis: ${!!analysis}, hasIntersected: ${hasIntersected}`)
    
    // If analysis is already provided, use it
    if (analysis) {
      console.log('Using provided analysis:', analysis)
      setLoadedAnalysis(analysis)
      return
    }

    // Load analysis when component becomes visible
    if (hasIntersected && !loadedAnalysis && !loading) {
      console.log('Loading analysis via API for noteId:', noteId)
      loadAnalysis()
    }
  }, [hasIntersected, analysis, loadedAnalysis, loading])

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch(`/api/notes/${noteId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error('Failed to load analysis')
      }

      const data = await response.json()
      console.log('API response data:', data)
      console.log('Analysis from API:', data.analysis)
      
      // data is the full note object, so extract the analysis field
      setLoadedAnalysis(data.analysis || null)
    } catch (err) {
      console.error('Error loading analysis:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={elementRef} className={className}>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-500">Loading analysis...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={loadAnalysis}
            className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {loadedAnalysis && !loading && (
        <AnalysisView 
          analysis={loadedAnalysis} 
          transcription={transcription} 
        />
      )}

      {!loadedAnalysis && !loading && !error && hasIntersected && transcription && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-orange-700 font-medium">Analysis Incomplete</p>
          </div>
          <p className="text-sm text-orange-600 mb-4">
            Your audio was transcribed successfully, but the AI analysis failed to complete.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-md font-medium"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {!loadedAnalysis && !loading && !error && hasIntersected && !transcription && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">Processing Failed</p>
          </div>
          <p className="text-sm text-red-600 mb-4">
            This note failed to process completely. Both transcription and analysis are missing.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-md font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {!hasIntersected && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">Analysis will load when visible</p>
        </div>
      )}
    </div>
  )
}