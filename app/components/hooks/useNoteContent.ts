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
    const myTasks = analysis.myTasks?.length || 0
    const keyIdeas = analysis.keyIdeas?.length || 0
    const messages = analysis.messages?.length || 0

    return { myTasks, keyIdeas, messages }
  }, [note.analysis])

  const primaryTopic = useMemo(() => {
    if (!note.analysis?.topics?.length) return null
    return note.analysis.topics[0]
  }, [note.analysis])

  const minorTopics = useMemo(() => {
    if (!note.analysis?.topics?.length) return []
    return note.analysis.topics.slice(1)
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