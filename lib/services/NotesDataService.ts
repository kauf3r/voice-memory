/**
 * Notes Data Service for Knowledge API
 * Handles fetching and managing notes data
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ProcessedNote } from './KnowledgeTypes'

export class NotesDataService {
  constructor(private dbClient: SupabaseClient) {}

  /**
   * Fetch all processed notes for a user
   */
  async getProcessedNotes(userId: string): Promise<ProcessedNote[]> {
    console.log('🔍 NotesDataService - querying notes table for user:', userId)
    
    const { data: notes, error: notesError } = await this.dbClient
      .from('notes')
      .select('id, analysis, transcription, recorded_at, processed_at')
      .eq('user_id', userId)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    console.log('📊 Notes query result:', {
      error: notesError,
      notesCount: notes?.length || 0,
      hasNotes: !!notes,
      sampleNoteIds: notes?.slice(0, 3).map(n => n.id) || []
    })

    if (notesError) {
      console.error('❌ Failed to fetch notes:', notesError)
      throw new Error('Failed to fetch knowledge data')
    }

    console.log(`📊 Found ${notes?.length || 0} notes with analysis for user ${userId}`)
    
    // Log sample of note structure if notes exist
    if (notes && notes.length > 0) {
      const sampleNote = notes[0]
      console.log('📝 Sample note structure:', {
        id: sampleNote.id,
        hasAnalysis: !!sampleNote.analysis,
        hasTranscription: !!sampleNote.transcription,
        recorded_at: sampleNote.recorded_at,
        processed_at: sampleNote.processed_at,
        analysisKeys: sampleNote.analysis ? Object.keys(sampleNote.analysis) : []
      })
    }

    return notes as ProcessedNote[] || []
  }

  /**
   * Calculate last modified date from notes for caching
   */
  static calculateLastModified(notes: ProcessedNote[]): number {
    if (!notes || notes.length === 0) {
      return Date.now()
    }

    return Math.max(
      ...notes
        .filter(n => n.processed_at)
        .map(n => new Date(n.processed_at!).getTime())
    )
  }

  /**
   * Validate note structure for processing
   */
  static validateNotes(notes: ProcessedNote[]): { valid: ProcessedNote[], invalid: number } {
    const valid: ProcessedNote[] = []
    let invalid = 0

    for (const note of notes) {
      if (!note.analysis) {
        invalid++
        continue
      }
      valid.push(note)
    }

    console.log('📊 Note validation result:', {
      total: notes.length,
      valid: valid.length,
      invalid
    })

    return { valid, invalid }
  }
}