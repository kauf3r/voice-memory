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
      return { tasks: 0, nowTasks: 0, messages: 0 }
    }

    const analysis = note.analysis
    const tasks = analysis.tasks?.length || 0
    const nowTasks = analysis.tasks?.filter(t => t.urgency === 'NOW').length || 0
    const messages = analysis.draftMessages?.length || 0

    return { tasks, nowTasks, messages }
  }, [note.analysis])

  const topic = useMemo(() => {
    return note.analysis?.topic || null
  }, [note.analysis])

  const mood = useMemo(() => {
    return note.analysis?.mood || null
  }, [note.analysis])

  const summary = useMemo(() => {
    return note.analysis?.summary || null
  }, [note.analysis])

  const theOneThing = useMemo(() => {
    return note.analysis?.theOneThing || null
  }, [note.analysis])

  const hasFullAnalysis = useMemo(() => {
    return !!(note.analysis && note.transcription)
  }, [note.analysis, note.transcription])

  return {
    formatDuration,
    quickStats,
    topic,
    mood,
    summary,
    theOneThing,
    hasFullAnalysis
  }
}