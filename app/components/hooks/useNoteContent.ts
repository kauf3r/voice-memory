'use client'

import { useMemo } from 'react'
import { Note } from '@/lib/types'

export function useNoteContent(note: Note) {
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown duration'
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes === 0) {
      return `${remainingSeconds}s`
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const quickStats = useMemo(() => {
    if (!note.analysis) {
      return { myTasks: 0, keyIdeas: 0, messages: 0 }
    }

    const analysis = note.analysis
    const myTasks = analysis.tasks?.myTasks?.length || 0
    const keyIdeas = analysis.keyIdeas?.length || 0
    const messages = analysis.messagesToDraft?.length || 0

    return { myTasks, keyIdeas, messages }
  }, [note.analysis])

  const primaryTopic = useMemo(() => {
    if (!note.analysis?.focusTopics?.primary) return null
    return note.analysis.focusTopics.primary
  }, [note.analysis])

  const minorTopics = useMemo(() => {
    if (!note.analysis?.focusTopics?.minor) return []
    return note.analysis.focusTopics.minor
  }, [note.analysis])

  const sentiment = useMemo(() => {
    return note.analysis?.sentiment || null
  }, [note.analysis])

  const hasFullAnalysis = useMemo(() => {
    return !!(note.analysis && note.transcription)
  }, [note.analysis, note.transcription])

  return {
    formatDuration,
    quickStats,
    primaryTopic,
    minorTopics,
    sentiment,
    hasFullAnalysis
  }
}