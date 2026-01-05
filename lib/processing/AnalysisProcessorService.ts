/**
 * Analysis Processor Service - Handles AI analysis of transcriptions
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { AnalysisProcessor, AnalysisResult, ProcessingContext } from './interfaces'
import { analyzeTranscription } from '../openai'

export class AnalysisProcessorService implements AnalysisProcessor {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async analyze(transcription: string, context: string, recordedAt: string): Promise<AnalysisResult> {
    try {
      console.log('Starting AI analysis of transcription...')
      
      const { analysis, error: analysisError, warning } = await analyzeTranscription(
        transcription, 
        context, 
        recordedAt
      )

      if (analysisError) {
        throw new Error(`Analysis failed: ${analysisError.message}`)
      }

      const result: AnalysisResult = {
        analysis,
        warning
      }

      // Extract knowledge updates if present
      if (analysis?.crossReferences?.projectKnowledgeUpdates?.length > 0) {
        result.knowledgeUpdates = analysis.crossReferences.projectKnowledgeUpdates
      }

      return result

    } catch (error) {
      throw error instanceof Error ? error : new Error(`Analysis processing failed: ${error}`)
    }
  }

  async getProjectKnowledgeContext(userId: string): Promise<string> {
    try {
      const { data: projectKnowledge } = await this.client
        .from('project_knowledge')
        .select('content')
        .eq('user_id', userId)
        .single()

      return projectKnowledge?.content ? 
        JSON.stringify(projectKnowledge.content) : 
        ''
        
    } catch (error) {
      console.warn('Failed to get project knowledge context:', error)
      return ''
    }
  }

  async updateProjectKnowledge(userId: string, updates: string[]): Promise<void> {
    try {
      // Get current knowledge
      const { data: currentKnowledge } = await this.client
        .from('project_knowledge')
        .select('content')
        .eq('user_id', userId)
        .single()

      const current = currentKnowledge?.content || {}
      
      // Update knowledge
      const newKnowledge = {
        ...current,
        lastUpdated: new Date().toISOString(),
        recentInsights: [
          ...(current.recentInsights || []),
          ...updates
        ].slice(-50) // Keep last 50 insights
      }

      await this.client
        .from('project_knowledge')
        .upsert({
          user_id: userId,
          content: newKnowledge,
          updated_at: new Date().toISOString(),
        })
        
      console.log(`Updated project knowledge with ${updates.length} new insights for user ${userId}`)
      
    } catch (error) {
      console.warn('Failed to update project knowledge:', error)
      // Don't fail the whole job for this
    }
  }

  async saveAnalysisProgress(noteId: string, analysis: any): Promise<void> {
    try {
      await this.client
        .from('notes')
        .update({ analysis })
        .eq('id', noteId)
        
      console.log(`Saved analysis progress for note ${noteId}`)
      
    } catch (error) {
      console.warn(`Failed to save analysis progress for note ${noteId}:`, error)
    }
  }

  async validateAnalysisStructure(analysis: any): Promise<boolean> {
    try {
      // Basic validation of expected analysis structure
      if (!analysis || typeof analysis !== 'object') {
        return false
      }

      // Check for required top-level properties
      const requiredProperties = ['sentiment', 'topics', 'tasks', 'ideas', 'messages', 'crossReferences', 'outreach']
      const hasRequiredProperties = requiredProperties.every(prop => prop in analysis)

      if (!hasRequiredProperties) {
        console.warn('Analysis missing required properties:', {
          expected: requiredProperties,
          actual: Object.keys(analysis)
        })
        return false
      }

      // Validate array properties
      const arrayProperties = ['topics', 'tasks', 'ideas', 'messages']
      for (const prop of arrayProperties) {
        if (!Array.isArray(analysis[prop])) {
          console.warn(`Analysis property '${prop}' should be an array, got:`, typeof analysis[prop])
          return false
        }
      }

      return true
      
    } catch (error) {
      console.warn('Error validating analysis structure:', error)
      return false
    }
  }

  extractTasksFromAnalysis(analysis: any): any[] {
    try {
      if (!analysis?.tasks || !Array.isArray(analysis.tasks)) {
        return []
      }

      return analysis.tasks.map((task: any, index: number) => ({
        id: `task-${index}`,
        description: task.description || task.task || '',
        type: task.type || 'myTasks',
        assignedTo: task.assignedTo,
        nextSteps: task.nextSteps,
        context: task.context,
        priority: task.priority || 'medium'
      }))
      
    } catch (error) {
      console.warn('Error extracting tasks from analysis:', error)
      return []
    }
  }

  extractTopicsFromAnalysis(analysis: any): string[] {
    try {
      if (!analysis?.topics || !Array.isArray(analysis.topics)) {
        return []
      }

      return analysis.topics.map((topic: any) =>
        typeof topic === 'string' ? topic : topic.name || topic.topic || ''
      ).filter(Boolean)

    } catch (error) {
      console.warn('Error extracting topics from analysis:', error)
      return []
    }
  }

  /**
   * Save open loops (decisions and waiting-for items) from V2 analysis
   */
  async saveOpenLoops(noteId: string, userId: string, analysis: any): Promise<void> {
    try {
      const openLoops = analysis?.openLoops
      if (!openLoops || !Array.isArray(openLoops) || openLoops.length === 0) {
        return
      }

      const records = openLoops
        .filter((loop: any) => loop.type && loop.description)
        .map((loop: any) => ({
          note_id: noteId,
          user_id: userId,
          type: loop.type,
          description: loop.description,
          resolved: false
        }))

      if (records.length === 0) {
        return
      }

      const { error } = await this.client
        .from('open_loops')
        .insert(records)

      if (error) {
        console.warn(`Failed to save open loops for note ${noteId}:`, error)
      } else {
        console.log(`Saved ${records.length} open loops for note ${noteId}`)
      }
    } catch (error) {
      console.warn(`Error saving open loops for note ${noteId}:`, error)
      // Don't fail the whole job for this
    }
  }
}