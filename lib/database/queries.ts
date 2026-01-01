/**
 * Database Queries - Centralized Database Access Layer
 * 
 * This abstraction layer prevents direct table references and provides
 * a consistent API for all database operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TABLES, COLUMNS, FUNCTIONS, DATABASE_CONFIG, DATABASE_ERRORS, SELECT_COLUMNS } from './constants';

// Type definitions for database operations
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface NoteRecord {
  id: string;
  user_id: string;
  audio_url: string;
  duration_seconds?: number;
  transcription?: string;
  analysis?: any;
  recorded_at?: string;
  processed_at?: string;
  created_at?: string;
  error_message?: string;
  processing_attempts?: number;
  last_error_at?: string;
  processing_started_at?: string;
}

export interface TaskStateRecord {
  id: string;
  user_id: string;
  task_id: string;
  completed: boolean;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskPinRecord {
  id: string;
  user_id: string;
  task_id: string;
  pinned_at: string;
  display_order?: number;
}

export interface ProcessingStatsRecord {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Database Service Class - Centralized database operations
 */
export class DatabaseService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  // ============================================================================
  // NOTES TABLE OPERATIONS
  // ============================================================================

  async getNoteById(noteId: string, userId?: string): Promise<DatabaseResult<NoteRecord>> {
    try {
      let query = this.client
        .from(TABLES.NOTES)
        .select(SELECT_COLUMNS.NOTES_FULL)
        .eq(COLUMNS.NOTES.ID, noteId);

      if (userId) {
        query = query.eq(COLUMNS.NOTES.USER_ID, userId);
      }

      const { data, error } = await query.single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: `Failed to fetch note: ${err}` };
    }
  }

  async getNotesByUser(
    userId: string, 
    options: {
      limit?: number;
      processed?: boolean;
      hasAnalysis?: boolean;
      orderBy?: 'created_at' | 'processed_at' | 'recorded_at';
      ascending?: boolean;
    } = {}
  ): Promise<DatabaseResult<NoteRecord[]>> {
    try {
      const {
        limit = DATABASE_CONFIG.DEFAULT_LIMIT,
        processed,
        hasAnalysis,
        orderBy = 'created_at',
        ascending = false
      } = options;

      let query = this.client
        .from(TABLES.NOTES)
        .select(SELECT_COLUMNS.NOTES_FULL)
        .eq(COLUMNS.NOTES.USER_ID, userId);

      // Filter by processing status
      if (processed !== undefined) {
        if (processed) {
          query = query.not(COLUMNS.NOTES.PROCESSED_AT, 'is', null);
        } else {
          query = query.is(COLUMNS.NOTES.PROCESSED_AT, null);
        }
      }

      // Filter by analysis availability
      if (hasAnalysis !== undefined) {
        if (hasAnalysis) {
          query = query.not(COLUMNS.NOTES.ANALYSIS, 'is', null);
        } else {
          query = query.is(COLUMNS.NOTES.ANALYSIS, null);
        }
      }

      // Apply ordering and limit
      query = query
        .order(orderBy, { ascending })
        .limit(Math.min(limit, DATABASE_CONFIG.MAX_LIMIT));

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [], count };
    } catch (err) {
      return { success: false, error: `Failed to fetch notes: ${err}` };
    }
  }

  async updateNoteProcessing(
    noteId: string, 
    updates: {
      processing_started_at?: string | null;
      processed_at?: string | null;
      transcription?: string;
      analysis?: any;
      error_message?: string | null;
      processing_attempts?: number;
      last_error_at?: string | null;
    }
  ): Promise<DatabaseResult<NoteRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLES.NOTES)
        .update(updates)
        .eq(COLUMNS.NOTES.ID, noteId)
        .select(SELECT_COLUMNS.NOTES_FULL)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: `Failed to update note: ${err}` };
    }
  }

  // ============================================================================
  // TASK MANAGEMENT OPERATIONS
  // ============================================================================

  async getTaskStatesByUser(
    userId: string,
    taskIds?: string[]
  ): Promise<DatabaseResult<TaskStateRecord[]>> {
    try {
      let query = this.client
        .from(TABLES.TASK_STATES)
        .select(SELECT_COLUMNS.TASK_STATES_FULL)
        .eq(COLUMNS.TASK_STATES.USER_ID, userId);

      if (taskIds && taskIds.length > 0) {
        query = query.in(COLUMNS.TASK_STATES.TASK_ID, taskIds);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: `Failed to fetch task states: ${err}` };
    }
  }

  async updateTaskState(
    userId: string,
    taskId: string,
    completed: boolean
  ): Promise<DatabaseResult<TaskStateRecord>> {
    try {
      const updateData = {
        [COLUMNS.TASK_STATES.USER_ID]: userId,
        [COLUMNS.TASK_STATES.TASK_ID]: taskId,
        [COLUMNS.TASK_STATES.COMPLETED]: completed,
        [COLUMNS.TASK_STATES.COMPLETED_AT]: completed ? new Date().toISOString() : null,
        [COLUMNS.TASK_STATES.UPDATED_AT]: new Date().toISOString()
      };

      const { data, error } = await this.client
        .from(TABLES.TASK_STATES)
        .upsert(updateData, {
          onConflict: `${COLUMNS.TASK_STATES.USER_ID},${COLUMNS.TASK_STATES.TASK_ID}`
        })
        .select(SELECT_COLUMNS.TASK_STATES_FULL)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: `Failed to update task state: ${err}` };
    }
  }

  async getPinnedTasksByUser(userId: string): Promise<DatabaseResult<TaskPinRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(TABLES.TASK_PINS)
        .select('id, user_id, task_id, pinned_at, display_order')
        .eq(COLUMNS.TASK_PINS.USER_ID, userId)
        .order(COLUMNS.TASK_PINS.DISPLAY_ORDER, { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: `Failed to fetch pinned tasks: ${err}` };
    }
  }

  async pinTask(userId: string, taskId: string): Promise<DatabaseResult<TaskPinRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLES.TASK_PINS)
        .insert({
          [COLUMNS.TASK_PINS.USER_ID]: userId,
          [COLUMNS.TASK_PINS.TASK_ID]: taskId,
          [COLUMNS.TASK_PINS.PINNED_AT]: new Date().toISOString()
        })
        .select('id, user_id, task_id, pinned_at, display_order')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: `Failed to pin task: ${err}` };
    }
  }

  async unpinTask(userId: string, taskId: string): Promise<DatabaseResult<void>> {
    try {
      const { error } = await this.client
        .from(TABLES.TASK_PINS)
        .delete()
        .eq(COLUMNS.TASK_PINS.USER_ID, userId)
        .eq(COLUMNS.TASK_PINS.TASK_ID, taskId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: `Failed to unpin task: ${err}` };
    }
  }

  // ============================================================================
  // PROCESSING FUNCTIONS
  // ============================================================================

  async acquireProcessingLock(
    noteId: string, 
    timeoutMinutes: number = DATABASE_CONFIG.PROCESSING_LOCK_TIMEOUT
  ): Promise<DatabaseResult<boolean>> {
    try {
      const { data, error } = await this.client
        .rpc(FUNCTIONS.ACQUIRE_PROCESSING_LOCK, {
          p_note_id: noteId,
          p_lock_timeout_minutes: timeoutMinutes
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || false };
    } catch (err) {
      return { success: false, error: `Failed to acquire processing lock: ${err}` };
    }
  }

  async releaseProcessingLock(noteId: string): Promise<DatabaseResult<void>> {
    try {
      const { error } = await this.client
        .rpc(FUNCTIONS.RELEASE_PROCESSING_LOCK, {
          p_note_id: noteId
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: `Failed to release processing lock: ${err}` };
    }
  }

  async getProcessingStats(userId: string): Promise<DatabaseResult<ProcessingStatsRecord>> {
    try {
      const { data, error } = await this.client
        .rpc(FUNCTIONS.GET_PROCESSING_STATS, {
          p_user_id: userId
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data?.[0] || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 } };
    } catch (err) {
      return { success: false, error: `Failed to get processing stats: ${err}` };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async validateTableExists(tableName: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(tableName)
        .select('id')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  async getTableNames(): Promise<string[]> {
    try {
      // This would require a custom function or direct SQL access
      // For now, return the expected tables
      return Object.values(TABLES);
    } catch {
      return [];
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a database service instance with the provided Supabase client
 */
export function createDatabaseService(client: SupabaseClient): DatabaseService {
  return new DatabaseService(client);
}

/**
 * Create a database service instance with service role privileges
 */
export function createServiceDatabaseService(): DatabaseService {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return new DatabaseService(client);
}

/**
 * Create a database service instance with user authentication
 */
export function createUserDatabaseService(accessToken: string): DatabaseService {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
  return new DatabaseService(client);
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Validate that the database schema matches our expected structure
 */
export async function validateDatabaseSchema(db: DatabaseService): Promise<{
  valid: boolean;
  missingTables: string[];
  errors: string[];
}> {
  const missingTables: string[] = [];
  const errors: string[] = [];

  for (const tableName of Object.values(TABLES)) {
    const exists = await db.validateTableExists(tableName);
    if (!exists) {
      missingTables.push(tableName);
      errors.push(DATABASE_ERRORS.TABLE_NOT_FOUND(tableName));
    }
  }

  return {
    valid: missingTables.length === 0,
    missingTables,
    errors
  };
}