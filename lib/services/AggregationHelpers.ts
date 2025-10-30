/**
 * Helper functions for knowledge data aggregation
 */

import { KnowledgeStats, KnowledgeContent, KnowledgeTask, TaskCompletionInfo, ProcessedNote } from './KnowledgeTypes'

export class AggregationHelpers {
  /**
   * Initialize empty knowledge stats
   */
  static createEmptyStats(): KnowledgeStats {
    return {
      totalNotes: 0,
      totalInsights: 0,
      totalTasks: 0,
      totalMessages: 0,
      totalOutreach: 0,
      completedTasks: 0,
      taskCompletionRate: 0,
      sentimentDistribution: {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
      timeRange: {
        earliest: null,
        latest: null,
      },
    }
  }

  /**
   * Initialize empty knowledge content
   */
  static createEmptyContent(): KnowledgeContent {
    return {
      recentInsights: [],
      topTopics: {},
      keyContacts: {},
      commonTasks: {},
      allTasks: [],
      sentimentTrends: [],
      knowledgeTimeline: [],
    }
  }

  /**
   * Process insights from note analysis
   */
  static processInsights(analysis: any, stats: KnowledgeStats, content: KnowledgeContent): void {
    if (analysis.keyIdeas) {
      stats.totalInsights += analysis.keyIdeas.length
      content.recentInsights.push(...analysis.keyIdeas)
    }
  }

  /**
   * Process tasks from note analysis with completion states
   */
  static processTasks(
    note: ProcessedNote,
    analysis: any,
    completionMap: Map<string, TaskCompletionInfo>,
    stats: KnowledgeStats,
    content: KnowledgeContent
  ): void {
    // Process my tasks
    if (analysis.tasks?.myTasks) {
      stats.totalTasks += analysis.tasks.myTasks.length
      analysis.tasks.myTasks.forEach((task: string | object, index: number) => {
        const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
        const taskDetails = typeof task === 'object' ? task as any : null
        
        content.commonTasks[taskDescription] = (content.commonTasks[taskDescription] || 0) + 1
        const taskId = `${note.id}-my-${index}`
        const completion = completionMap.get(taskId)
        
        content.allTasks.push({
          id: taskId,
          description: taskDescription,
          type: 'myTasks',
          date: note.recorded_at,
          noteId: note.id,
          noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
          nextSteps: taskDetails?.nextSteps,
          assignedTo: taskDetails?.assignedTo,
          completed: !!completion,
          completedAt: completion?.completedAt,
          completedBy: completion?.completedBy,
          completionNotes: completion?.completionNotes
        })
      })
    }

    // Process delegated tasks
    if (analysis.tasks?.delegatedTasks) {
      stats.totalTasks += analysis.tasks.delegatedTasks.length
      analysis.tasks.delegatedTasks.forEach((task: string | object, index: number) => {
        const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
        const taskDetails = typeof task === 'object' ? task as any : null
        
        const taskId = `${note.id}-delegated-${index}`
        const completion = completionMap.get(taskId)
        
        content.allTasks.push({
          id: taskId,
          description: taskDescription,
          type: 'delegatedTasks',
          date: note.recorded_at,
          noteId: note.id,
          noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
          nextSteps: taskDetails?.nextSteps,
          assignedTo: taskDetails?.assignedTo,
          completed: !!completion,
          completedAt: completion?.completedAt,
          completedBy: completion?.completedBy,
          completionNotes: completion?.completionNotes
        })
      })
    }
  }

  /**
   * Process messages from note analysis
   */
  static processMessages(analysis: any, stats: KnowledgeStats): void {
    if (analysis.messagesToDraft) {
      stats.totalMessages += analysis.messagesToDraft.length
    }
  }

  /**
   * Process outreach and contacts from note analysis
   */
  static processOutreachAndContacts(analysis: any, stats: KnowledgeStats, content: KnowledgeContent): void {
    // Process outreach ideas
    if (analysis.outreachIdeas) {
      stats.totalOutreach += analysis.outreachIdeas.length
      analysis.outreachIdeas.forEach((idea: any) => {
        if (idea.contact) {
          content.keyContacts[idea.contact] = (content.keyContacts[idea.contact] || 0) + 1
        }
      })
    }

    // Handle structured data people (new format) with backward compatibility
    if (analysis.structuredData?.people) {
      analysis.structuredData.people.forEach((person: any) => {
        if (person.name) {
          content.keyContacts[person.name] = (content.keyContacts[person.name] || 0) + 1
        }
      })
    }

    // Handle message drafts for contacts
    if (analysis.messagesToDraft) {
      analysis.messagesToDraft.forEach((message: any) => {
        if (message.recipient) {
          content.keyContacts[message.recipient] = (content.keyContacts[message.recipient] || 0) + 1
        }
      })
    }
  }

  /**
   * Process sentiment analysis
   */
  static processSentiment(note: ProcessedNote, analysis: any, stats: KnowledgeStats, content: KnowledgeContent): void {
    if (analysis.sentiment?.classification) {
      const sentiment = analysis.sentiment.classification.toLowerCase()
      if (sentiment in stats.sentimentDistribution) {
        stats.sentimentDistribution[sentiment as keyof typeof stats.sentimentDistribution]++
      }
      
      content.sentimentTrends.push({
        date: note.recorded_at,
        sentiment: analysis.sentiment.classification
      })
    }
  }

  /**
   * Process topics from note analysis
   */
  static processTopics(analysis: any, content: KnowledgeContent): void {
    if (analysis.focusTopics?.primary) {
      content.topTopics[analysis.focusTopics.primary] = 
        (content.topTopics[analysis.focusTopics.primary] || 0) + 1
    }

    if (analysis.focusTopics?.minor) {
      analysis.focusTopics.minor.forEach((topic: string) => {
        content.topTopics[topic] = (content.topTopics[topic] || 0) + 1
      })
    }
  }

  /**
   * Process timeline entries
   */
  static processTimeline(note: ProcessedNote, analysis: any, content: KnowledgeContent): void {
    if (analysis.keyIdeas?.length > 0) {
      content.knowledgeTimeline.push({
        date: note.recorded_at,
        type: 'insight',
        content: analysis.keyIdeas[0], // Just the first insight for timeline
        noteId: note.id
      })
    }
  }

  /**
   * Update time range statistics
   */
  static updateTimeRange(note: ProcessedNote, stats: KnowledgeStats): void {
    if (!stats.timeRange.earliest || note.recorded_at < stats.timeRange.earliest) {
      stats.timeRange.earliest = note.recorded_at
    }
    if (!stats.timeRange.latest || note.recorded_at > stats.timeRange.latest) {
      stats.timeRange.latest = note.recorded_at
    }
  }

  /**
   * Sort and limit aggregated content for optimal performance
   */
  static sortAndLimitContent(content: KnowledgeContent, options: {
    maxInsights?: number
    maxTimelineItems?: number
    maxSentimentTrends?: number
  } = {}): void {
    const {
      maxInsights = 50,
      maxTimelineItems = 20,
      maxSentimentTrends = 30
    } = options

    // Sort and limit insights
    content.recentInsights = content.recentInsights
      .slice(-maxInsights)
      .reverse()

    // Sort tasks by date
    content.allTasks = content.allTasks
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Sort and limit timeline
    content.knowledgeTimeline = content.knowledgeTimeline
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxTimelineItems)

    // Sort and limit sentiment trends
    content.sentimentTrends = content.sentimentTrends
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxSentimentTrends)
  }

  /**
   * Calculate task completion statistics
   */
  static calculateTaskCompletionStats(stats: KnowledgeStats, content: KnowledgeContent): void {
    stats.completedTasks = content.allTasks.filter(task => task.completed).length
    stats.taskCompletionRate = stats.totalTasks > 0 
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0
  }

  /**
   * Create task completion map from task states
   */
  static createCompletionMap(taskStates: any[]): Map<string, TaskCompletionInfo> {
    const completionMap = new Map<string, TaskCompletionInfo>()
    
    if (taskStates) {
      taskStates
        .filter(ts => ts.completed) // Only include completed tasks
        .forEach(taskState => {
          completionMap.set(taskState.task_id, {
            completedAt: taskState.completed_at,
            completedBy: taskState.completed_by,
            completionNotes: taskState.completion_notes
          })
        })
    }

    console.log('📊 Completion map created with', completionMap.size, 'entries')
    return completionMap
  }
}