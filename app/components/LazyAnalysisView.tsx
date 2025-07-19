'use client'

import { useState, useEffect } from 'react'
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer'
import AnalysisView from './AnalysisView'
import LoadingSpinner from './LoadingSpinner'
import { NoteAnalysis } from '@/lib/types'

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
    // If analysis is already provided, use it
    if (analysis) {
      setLoadedAnalysis(analysis)
      return
    }

    // Load analysis when component becomes visible
    if (hasIntersected && !loadedAnalysis && !loading) {
      loadAnalysis()
    }
  }, [hasIntersected, analysis, loadedAnalysis, loading])

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/notes/${noteId}`)
      if (!response.ok) {
        throw new Error('Failed to load analysis')
      }

      const data = await response.json()
      setLoadedAnalysis(data.note.analysis)
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

      {!loadedAnalysis && !loading && !error && hasIntersected && (
        <div className="text-center py-8 text-gray-500">
          <p>No analysis available for this note</p>
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