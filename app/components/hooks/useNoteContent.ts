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

    // Handle both new format (array) and legacy format (object with myTasks/delegatedTasks)
    let taskCount = 0
    let nowTaskCount = 0

    if (Array.isArray(analysis.tasks)) {
      // New format: tasks is an array of AnalysisTask
      taskCount = analysis.tasks.length
      nowTaskCount = analysis.tasks.filter(t => t.urgency === 'NOW').length
    } else if (analysis.tasks && typeof analysis.tasks === 'object') {
      // Legacy format: tasks is { myTasks: [], delegatedTasks: [] }
      const legacyTasks = analysis.tasks as { myTasks?: unknown[]; delegatedTasks?: unknown[] }
      taskCount = (legacyTasks.myTasks?.length || 0) + (legacyTasks.delegatedTasks?.length || 0)
      nowTaskCount = 0 // Legacy format doesn't have urgency
    }

    // Handle both draftMessages (new) and messagesToDraft (legacy)
    const messages = analysis.draftMessages?.length || (analysis as any).messagesToDraft?.length || 0

    return { tasks: taskCount, nowTasks: nowTaskCount, messages }
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
    const raw = note.analysis?.theOneThing
    if (!raw) return null
    // Handle both string (legacy V1) and object (V2 format) for theOneThing
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object' && raw.task) return raw.task
    return null
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