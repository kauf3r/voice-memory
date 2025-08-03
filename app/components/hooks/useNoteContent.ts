import { useMemo } from 'react'
import { Note } from '@/lib/types'

export function useNoteContent(note: Note) {
  return useMemo(() => {
    const formatDuration = (seconds: number | null) => {
      if (!seconds) return 'Unknown'
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const getQuickStats = () => {
      if (!note.analysis) {
        return {
          myTasks: 0,
          keyIdeas: 0,
          messages: 0,
        }
      }

      return {
        myTasks: note.analysis.tasks?.myTasks?.length || 0,
        keyIdeas: note.analysis.keyIdeas?.length || 0,
        messages: note.analysis.messagesToDraft?.length || 0,
      }
    }

    const getPrimaryTopic = () => {
      return note.analysis?.focusTopics?.primary || null
    }

    const getMinorTopics = () => {
      return note.analysis?.focusTopics?.minor || []
    }

    const getSentiment = () => {
      return note.analysis?.sentiment || null
    }

    const hasFullAnalysis = !!(note.transcription && note.analysis)
    const hasPartialContent = !!note.transcription && !note.analysis
    const quickStats = getQuickStats()

    return {
      formatDuration,
      getQuickStats,
      getPrimaryTopic,
      getMinorTopics,
      getSentiment,
      hasFullAnalysis,
      hasPartialContent,
      quickStats,
      primaryTopic: getPrimaryTopic(),
      minorTopics: getMinorTopics(),
      sentiment: getSentiment(),
    }
  }, [note])
}