/**
 * Knowledge Aggregator Service
 * Handles the complex logic of aggregating knowledge from notes
 */

import { AggregatedKnowledge, ProcessedNote, TaskCompletionInfo, KnowledgeServiceOptions } from './KnowledgeTypes'
import { AggregationHelpers } from './AggregationHelpers'

export class KnowledgeAggregatorService {
  /**
   * Aggregate knowledge from processed notes
   */
  static aggregateFromNotes(
    notes: ProcessedNote[],
    completionMap: Map<string, TaskCompletionInfo> = new Map(),
    options: KnowledgeServiceOptions = {}
  ): AggregatedKnowledge {
    console.log('🔧 KnowledgeAggregatorService - aggregating knowledge from notes:', {
      notesCount: notes.length,
      completionMapSize: completionMap.size,
      firstNoteId: notes[0]?.id,
      firstNoteHasAnalysis: !!notes[0]?.analysis
    })

    // Handle empty notes case
    if (!notes || notes.length === 0) {
      console.log('📭 No notes found, returning empty knowledge base')
      return this.createEmptyKnowledgeBase()
    }

    // Initialize aggregation structures
    const stats = AggregationHelpers.createEmptyStats()
    const content = AggregationHelpers.createEmptyContent()
    
    stats.totalNotes = notes.length

    console.log('🔄 Processing', notes.length, 'notes for aggregation')
    let processedNotesCount = 0
    let notesWithoutAnalysis = 0

    // Process each note
    for (const note of notes) {
      try {
        const analysis = note.analysis
        if (!analysis) {
          notesWithoutAnalysis++
          continue
        }

        processedNotesCount++
        console.log(`📝 Processing note ${processedNotesCount}/${notes.length}:`, {
          noteId: note.id,
          analysisKeys: Object.keys(analysis),
          hasKeyIdeas: !!analysis.keyIdeas,
          keyIdeasCount: analysis.keyIdeas?.length || 0
        })

        // Process different aspects of the note
        this.processNoteAnalysis(note, analysis, completionMap, stats, content)

      } catch (noteError) {
        console.error('Error processing note:', note.id, noteError)
        // Continue with next note instead of failing completely
        continue
      }
    }

    // Post-processing
    this.finalizeAggregation(stats, content, options)

    console.log('🎯 Aggregation summary:', {
      totalNotesProcessed: notes.length,
      notesWithAnalysis: processedNotesCount,
      notesWithoutAnalysis: notesWithoutAnalysis,
      finalStats: {
        totalInsights: stats.totalInsights,
        totalTasks: stats.totalTasks,
        totalMessages: stats.totalMessages,
        totalOutreach: stats.totalOutreach,
        completedTasks: stats.completedTasks
      },
      finalContent: {
        recentInsightsCount: content.recentInsights.length,
        topTopicsCount: Object.keys(content.topTopics).length,
        keyContactsCount: Object.keys(content.keyContacts).length,
        allTasksCount: content.allTasks.length,
        timelineItemsCount: content.knowledgeTimeline.length
      }
    })

    return {
      stats,
      content,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Process a single note's analysis
   */
  private static processNoteAnalysis(
    note: ProcessedNote,
    analysis: any,
    completionMap: Map<string, TaskCompletionInfo>,
    stats: any,
    content: any
  ): void {
    // Process insights
    AggregationHelpers.processInsights(analysis, stats, content)

    // Process tasks with completion states
    AggregationHelpers.processTasks(note, analysis, completionMap, stats, content)

    // Process messages
    AggregationHelpers.processMessages(analysis, stats)

    // Process outreach and contacts
    AggregationHelpers.processOutreachAndContacts(analysis, stats, content)

    // Process sentiment
    AggregationHelpers.processSentiment(note, analysis, stats, content)

    // Process topics
    AggregationHelpers.processTopics(analysis, content)

    // Process timeline
    AggregationHelpers.processTimeline(note, analysis, content)

    // Update time range
    AggregationHelpers.updateTimeRange(note, stats)
  }

  /**
   * Finalize aggregation with sorting and calculations
   */
  private static finalizeAggregation(stats: any, content: any, options: KnowledgeServiceOptions): void {
    // Sort and limit content
    AggregationHelpers.sortAndLimitContent(content, {
      maxInsights: options.maxInsights,
      maxTimelineItems: options.maxTimelineItems,
      maxSentimentTrends: options.maxSentimentTrends
    })

    // Calculate completion statistics
    AggregationHelpers.calculateTaskCompletionStats(stats, content)
  }

  /**
   * Create empty knowledge base for when no notes exist
   */
  private static createEmptyKnowledgeBase(): AggregatedKnowledge {
    return {
      stats: AggregationHelpers.createEmptyStats(),
      content: AggregationHelpers.createEmptyContent(),
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Validate aggregated knowledge structure
   */
  static validateAggregatedKnowledge(knowledge: AggregatedKnowledge): boolean {
    try {
      return !!(
        knowledge.stats &&
        knowledge.content &&
        knowledge.generatedAt &&
        typeof knowledge.stats.totalNotes === 'number' &&
        Array.isArray(knowledge.content.recentInsights) &&
        Array.isArray(knowledge.content.allTasks)
      )
    } catch {
      return false
    }
  }
}