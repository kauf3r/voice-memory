/**
 * Main Knowledge Service - Orchestrates all knowledge operations
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { TaskStateService } from './TaskStateService'
import { NotesDataService } from './NotesDataService'
import { ProjectKnowledgeService } from './ProjectKnowledgeService'
import { KnowledgeAggregatorService } from './KnowledgeAggregatorService'
import { AggregationHelpers } from './AggregationHelpers'
import { ErrorHandler } from './ErrorHandler'
import {
  AggregatedKnowledge,
  KnowledgeResponse,
  KnowledgeServiceOptions,
  AuthenticationContext
} from './KnowledgeTypes'

export class KnowledgeService {
  private notesDataService: NotesDataService
  private projectKnowledgeService: ProjectKnowledgeService
  private taskStateService: TaskStateService

  constructor(private authContext: AuthenticationContext) {
    this.notesDataService = new NotesDataService(authContext.dbClient)
    this.projectKnowledgeService = new ProjectKnowledgeService(authContext.dbClient)
    this.taskStateService = new TaskStateService(authContext.dbClient)
  }

  /**
   * Get aggregated knowledge for a user
   */
  async getKnowledge(options: KnowledgeServiceOptions = {}): Promise<AggregatedKnowledge> {
    console.log('🔍 KnowledgeService - getting knowledge for user:', this.authContext.user.id)

    try {
      // Fetch notes data
      const notes = await this.notesDataService.getProcessedNotes(this.authContext.user.id)

      // Get task states for completion tracking
      const taskStates = await this.getTaskStates()

      // Create completion map
      const completionMap = AggregationHelpers.createCompletionMap(taskStates)

      // Aggregate knowledge from notes
      const aggregatedData = KnowledgeAggregatorService.aggregateFromNotes(
        notes,
        completionMap,
        options
      )

      console.log('✅ Knowledge aggregation complete:', {
        totalNotes: aggregatedData.stats.totalNotes,
        totalInsights: aggregatedData.stats.totalInsights,
        totalTasks: aggregatedData.stats.totalTasks,
        recentInsightsCount: aggregatedData.content.recentInsights.length,
        topTopicsCount: Object.keys(aggregatedData.content.topTopics).length,
        allTasksCount: aggregatedData.content.allTasks?.length || 0
      })

      return aggregatedData

    } catch (error) {
      ErrorHandler.logError(error, 'KnowledgeService.getKnowledge')
      
      // Return safe fallback instead of throwing
      return ErrorHandler.handleAggregationError(error)
    }
  }

  /**
   * Get complete knowledge response including project knowledge
   */
  async getCompleteKnowledge(options: KnowledgeServiceOptions = {}): Promise<KnowledgeResponse> {
    console.log('📊 KnowledgeService - getting complete knowledge')

    try {
      // Get aggregated knowledge
      const aggregatedData = await this.getKnowledge(options)

      // Get project knowledge if requested
      let projectKnowledge = {}
      let lastUpdated = new Date().toISOString()

      if (options.includeProjectKnowledge !== false) {
        try {
          const projectKnowledgeData = await this.projectKnowledgeService.getProjectKnowledge(
            this.authContext.user.id
          )
          projectKnowledge = projectKnowledgeData?.content || {}
          lastUpdated = projectKnowledgeData?.updated_at || lastUpdated
        } catch (error) {
          console.warn('Could not fetch project knowledge:', error)
        }
      }

      const response: KnowledgeResponse = {
        success: true,
        knowledge: {
          ...aggregatedData,
          projectKnowledge,
          lastUpdated
        }
      }

      console.log('📤 Complete knowledge response prepared:', {
        hasAggregatedData: !!aggregatedData,
        aggregatedDataKeys: aggregatedData ? Object.keys(aggregatedData) : [],
        statsExists: !!aggregatedData?.stats,
        contentExists: !!aggregatedData?.content,
        projectKnowledgeExists: Object.keys(projectKnowledge).length > 0,
        responseSize: JSON.stringify(response).length
      })

      return response

    } catch (error) {
      ErrorHandler.logError(error, 'KnowledgeService.getCompleteKnowledge')
      throw error
    }
  }

  /**
   * Update project knowledge
   */
  async updateProjectKnowledge(content: Record<string, any>): Promise<any> {
    console.log('💾 KnowledgeService - updating project knowledge')

    try {
      const knowledge = await this.projectKnowledgeService.updateProjectKnowledge(
        this.authContext.user.id,
        content
      )

      return {
        success: true,
        knowledge
      }

    } catch (error) {
      ErrorHandler.logError(error, 'KnowledgeService.updateProjectKnowledge')
      throw error
    }
  }

  /**
   * Get task states with error handling
   */
  private async getTaskStates(): Promise<any[]> {
    console.log('🔍 KnowledgeService - querying task_states table for user:', this.authContext.user.id)

    try {
      const taskStates = await this.taskStateService.getTaskStates({
        user_id: this.authContext.user.id
      })

      console.log('📊 Task states query result:', {
        taskStatesCount: taskStates.length,
        hasTaskStates: !!taskStates
      })

      return taskStates

    } catch (error) {
      return ErrorHandler.handleTaskStateError(error)
    }
  }

  /**
   * Get last modified date for caching
   */
  async getLastModified(): Promise<Date> {
    try {
      const notes = await this.notesDataService.getProcessedNotes(this.authContext.user.id)
      const lastModified = NotesDataService.calculateLastModified(notes)
      return new Date(lastModified)
    } catch (error) {
      console.warn('Could not determine last modified date:', error)
      return new Date()
    }
  }

  /**
   * Validate service health
   */
  async validateHealth(): Promise<boolean> {
    try {
      // Check database connectivity
      await this.notesDataService.getProcessedNotes(this.authContext.user.id)
      return true
    } catch (error) {
      ErrorHandler.logError(error, 'KnowledgeService.validateHealth')
      return false
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<any> {
    try {
      const notes = await this.notesDataService.getProcessedNotes(this.authContext.user.id)
      const taskStates = await this.getTaskStates()

      return {
        notesCount: notes.length,
        taskStatesCount: taskStates.length,
        authMethod: this.authContext.authMethod,
        lastSync: new Date().toISOString()
      }
    } catch (error) {
      ErrorHandler.logError(error, 'KnowledgeService.getServiceStats')
      return {
        notesCount: 0,
        taskStatesCount: 0,
        authMethod: this.authContext.authMethod,
        lastSync: new Date().toISOString(),
        error: 'Failed to get stats'
      }
    }
  }
}