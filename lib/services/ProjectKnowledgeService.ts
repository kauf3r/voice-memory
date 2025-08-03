/**
 * Project Knowledge Service for Knowledge API
 * Handles project knowledge CRUD operations
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ProjectKnowledge {
  id?: string
  user_id: string
  content: Record<string, any>
  updated_at: string
}

export class ProjectKnowledgeService {
  constructor(private dbClient: SupabaseClient) {}

  /**
   * Get project knowledge for a user
   */
  async getProjectKnowledge(userId: string): Promise<ProjectKnowledge | null> {
    console.log('🔍 ProjectKnowledgeService - fetching project knowledge for user:', userId)

    const { data: projectKnowledge, error: knowledgeError } = await this.dbClient
      .from('project_knowledge')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (knowledgeError && knowledgeError.code !== 'PGRST116') {
      console.error('Failed to fetch project knowledge:', knowledgeError)
      return null
    }

    console.log('📊 Project knowledge result:', {
      found: !!projectKnowledge,
      hasContent: !!projectKnowledge?.content
    })

    return projectKnowledge as ProjectKnowledge
  }

  /**
   * Update or create project knowledge
   */
  async updateProjectKnowledge(userId: string, content: Record<string, any>): Promise<ProjectKnowledge> {
    console.log('💾 ProjectKnowledgeService - updating project knowledge for user:', userId)

    if (!content || typeof content !== 'object') {
      throw new Error('Invalid content provided')
    }

    const { data: knowledge, error: updateError } = await this.dbClient
      .from('project_knowledge')
      .upsert({
        user_id: userId,
        content,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update project knowledge:', updateError)
      throw new Error('Failed to update knowledge')
    }

    console.log('✅ Project knowledge updated successfully')
    return knowledge as ProjectKnowledge
  }

  /**
   * Delete project knowledge for a user
   */
  async deleteProjectKnowledge(userId: string): Promise<boolean> {
    console.log('🗑️ ProjectKnowledgeService - deleting project knowledge for user:', userId)

    const { error } = await this.dbClient
      .from('project_knowledge')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to delete project knowledge:', error)
      return false
    }

    console.log('✅ Project knowledge deleted successfully')
    return true
  }

  /**
   * Get project knowledge last updated date for caching
   */
  async getLastUpdated(userId: string): Promise<string> {
    const knowledge = await this.getProjectKnowledge(userId)
    return knowledge?.updated_at || new Date().toISOString()
  }
}