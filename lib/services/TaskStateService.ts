/**
 * Unified Task State Management Service
 * 
 * Provides a centralized service for managing all task states (pinned, completed, archived)
 * using the unified task_states table instead of separate tables.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// Column selection for task_states queries (avoids SELECT *)
const TASK_STATE_COLUMNS = 'id, user_id, task_id, note_id, completed, completed_at, completed_by, completion_notes, pinned, pinned_at, pin_order, archived, archived_at, metadata, created_at, updated_at'

export interface TaskState {
  id: string
  user_id: string
  task_id: string
  note_id: string
  completed: boolean
  completed_at?: string | null
  completed_by?: string | null
  completion_notes?: string | null
  pinned: boolean
  pinned_at?: string | null
  pin_order?: number | null
  archived: boolean
  archived_at?: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TaskStateFilter {
  user_id: string
  completed?: boolean
  pinned?: boolean
  archived?: boolean
  task_ids?: string[]
}

export interface PinTaskParams {
  user_id: string
  task_id: string
  note_id: string
}

export interface CompleteTaskParams {
  user_id: string
  task_id: string
  note_id: string
  completed_by?: string
  completion_notes?: string
}

export interface TaskStats {
  total_tasks: number
  completed_tasks: number
  pinned_tasks: number
  archived_tasks: number
  active_tasks: number
}

export class TaskStateService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get or create a task state for a specific task
   */
  async getOrCreateTaskState(params: PinTaskParams): Promise<TaskState> {
    const { user_id, task_id, note_id } = params

    // Try to get existing state
    const { data: existing, error: selectError } = await this.supabase
      .from('task_states')
      .select(TASK_STATE_COLUMNS)
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .maybeSingle()

    if (selectError) {
      throw new Error(`Failed to query task state: ${selectError.message}`)
    }

    if (existing) {
      return existing as TaskState
    }

    // Create new state
    const { data: created, error: insertError } = await this.supabase
      .from('task_states')
      .insert({
        user_id,
        task_id,
        note_id,
        completed: false,
        pinned: false,
        archived: false,
        metadata: {}
      })
      .select(TASK_STATE_COLUMNS)
      .single()

    if (insertError) {
      throw new Error(`Failed to create task state: ${insertError.message}`)
    }

    return created as TaskState
  }

  /**
   * Get all pinned tasks for a user
   */
  async getPinnedTasks(user_id: string): Promise<TaskState[]> {
    const { data, error } = await this.supabase
      .from('task_states')
      .select(TASK_STATE_COLUMNS)
      .eq('user_id', user_id)
      .eq('pinned', true)
      .order('pin_order', { ascending: true, nullsFirst: false })
      .order('pinned_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to get pinned tasks: ${error.message}`)
    }

    return data as TaskState[]
  }

  /**
   * Pin a task using atomic RPC to prevent race conditions
   */
  async pinTask(params: PinTaskParams): Promise<TaskState> {
    const { user_id, task_id, note_id } = params

    // Use atomic RPC function that handles locking and pin order calculation
    const { data, error } = await this.supabase
      .rpc('pin_task_atomic', {
        p_user_id: user_id,
        p_task_id: task_id,
        p_note_id: note_id
      })
      .single()

    if (error) {
      // Map database errors to user-friendly messages
      if (error.message.includes('Pin limit exceeded')) {
        throw new Error('Pin limit exceeded. Maximum 10 tasks can be pinned per user.')
      }
      if (error.message.includes('already pinned')) {
        throw new Error('Task is already pinned')
      }
      if (error.message.includes('Access denied')) {
        throw new Error('Access denied')
      }
      throw new Error(`Failed to pin task: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to pin task: no data returned')
    }

    // Type assertion for RPC response
    const rpcResult = data as {
      id: number
      user_id: string
      task_id: string
      note_id: string
      completed: boolean
      completed_at: string | null
      pinned: boolean
      pinned_at: string | null
      pin_order: number | null
      archived: boolean
      created_at: string
      updated_at: string
    }

    // Map RPC response to TaskState (fill in missing fields with defaults)
    return {
      id: String(rpcResult.id),
      user_id: rpcResult.user_id,
      task_id: rpcResult.task_id,
      note_id: rpcResult.note_id,
      completed: rpcResult.completed,
      completed_at: rpcResult.completed_at,
      completed_by: null,
      completion_notes: null,
      pinned: rpcResult.pinned,
      pinned_at: rpcResult.pinned_at,
      pin_order: rpcResult.pin_order,
      archived: rpcResult.archived,
      archived_at: null,
      metadata: {},
      created_at: rpcResult.created_at,
      updated_at: rpcResult.updated_at
    } as TaskState
  }

  /**
   * Unpin a task
   */
  async unpinTask(user_id: string, task_id: string): Promise<boolean> {
    const { data: taskState, error: selectError } = await this.supabase
      .from('task_states')
      .select('id, pinned')
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .eq('pinned', true)
      .maybeSingle()

    if (selectError) {
      throw new Error(`Failed to query task state: ${selectError.message}`)
    }

    if (!taskState) {
      return false // Task was not pinned
    }

    const { error: updateError } = await this.supabase
      .from('task_states')
      .update({
        pinned: false,
        pinned_at: null,
        pin_order: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskState.id)

    if (updateError) {
      throw new Error(`Failed to unpin task: ${updateError.message}`)
    }

    return true
  }

  /**
   * Complete a task
   */
  async completeTask(params: CompleteTaskParams): Promise<TaskState> {
    const { user_id, task_id, note_id, completed_by, completion_notes } = params

    // Get or create task state
    const taskState = await this.getOrCreateTaskState({
      user_id,
      task_id,
      note_id
    })

    if (taskState.completed) {
      throw new Error('Task is already completed')
    }

    // Update the task state
    const { data: updated, error: updateError } = await this.supabase
      .from('task_states')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by,
        completion_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskState.id)
      .select(TASK_STATE_COLUMNS)
      .single()

    if (updateError) {
      throw new Error(`Failed to complete task: ${updateError.message}`)
    }

    return updated as TaskState
  }

  /**
   * Uncomplete a task
   */
  async uncompleteTask(user_id: string, task_id: string): Promise<boolean> {
    const { data: taskState, error: selectError } = await this.supabase
      .from('task_states')
      .select('id, completed')
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .eq('completed', true)
      .maybeSingle()

    if (selectError) {
      throw new Error(`Failed to query task state: ${selectError.message}`)
    }

    if (!taskState) {
      return false // Task was not completed
    }

    const { error: updateError } = await this.supabase
      .from('task_states')
      .update({
        completed: false,
        completed_at: null,
        completed_by: null,
        completion_notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskState.id)

    if (updateError) {
      throw new Error(`Failed to uncomplete task: ${updateError.message}`)
    }

    return true
  }

  /**
   * Reorder pinned tasks
   */
  async reorderPinnedTasks(user_id: string, task_id: string, new_order: number): Promise<void> {
    const { data: taskState, error: selectError } = await this.supabase
      .from('task_states')
      .select('id, task_id, pinned, pin_order')
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .eq('pinned', true)
      .single()

    if (selectError) {
      throw new Error(`Failed to find pinned task: ${selectError.message}`)
    }

    if (!taskState.pinned) {
      throw new Error('Task is not pinned')
    }

    // Get all pinned tasks to reorder
    const { data: pinnedTasks, error: pinnedError } = await this.supabase
      .from('task_states')
      .select('id, task_id, pin_order')
      .eq('user_id', user_id)
      .eq('pinned', true)
      .order('pin_order', { ascending: true, nullsFirst: false })

    if (pinnedError) {
      throw new Error(`Failed to get pinned tasks: ${pinnedError.message}`)
    }

    // Remove the task being moved from the list
    const otherTasks = pinnedTasks.filter(t => t.task_id !== task_id)
    
    // Insert the task at the new position
    otherTasks.splice(new_order, 0, taskState)

    // Update pin orders for all affected tasks
    const updates = otherTasks.map((task, index) => ({
      id: task.id,
      pin_order: index + 1,
      updated_at: new Date().toISOString()
    }))

    for (const update of updates) {
      const { error: updateError } = await this.supabase
        .from('task_states')
        .update({
          pin_order: update.pin_order,
          updated_at: update.updated_at
        })
        .eq('id', update.id)

      if (updateError) {
        throw new Error(`Failed to update pin order: ${updateError.message}`)
      }
    }
  }

  /**
   * Get task states by filter
   */
  async getTaskStates(filter: TaskStateFilter): Promise<TaskState[]> {
    let query = this.supabase
      .from('task_states')
      .select(TASK_STATE_COLUMNS)
      .eq('user_id', filter.user_id)

    if (filter.completed !== undefined) {
      query = query.eq('completed', filter.completed)
    }

    if (filter.pinned !== undefined) {
      query = query.eq('pinned', filter.pinned)
    }

    if (filter.archived !== undefined) {
      query = query.eq('archived', filter.archived)
    }

    if (filter.task_ids && filter.task_ids.length > 0) {
      query = query.in('task_id', filter.task_ids)
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get task states: ${error.message}`)
    }

    return data as TaskState[]
  }

  /**
   * Get task statistics for a user
   */
  async getTaskStats(user_id: string): Promise<TaskStats> {
    const { data, error } = await this.supabase.rpc('get_task_stats', {
      p_user_id: user_id
    })

    if (error) {
      throw new Error(`Failed to get task stats: ${error.message}`)
    }

    return data[0] as TaskStats
  }

  /**
   * Archive a task
   */
  async archiveTask(user_id: string, task_id: string, note_id: string): Promise<TaskState> {
    // Get or create task state
    const taskState = await this.getOrCreateTaskState({
      user_id,
      task_id,
      note_id
    })

    if (taskState.archived) {
      throw new Error('Task is already archived')
    }

    // Update the task state
    const { data: updated, error: updateError } = await this.supabase
      .from('task_states')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskState.id)
      .select(TASK_STATE_COLUMNS)
      .single()

    if (updateError) {
      throw new Error(`Failed to archive task: ${updateError.message}`)
    }

    return updated as TaskState
  }

  /**
   * Check if a task is pinned
   */
  async isTaskPinned(user_id: string, task_id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('task_states')
      .select('pinned')
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check if task is pinned: ${error.message}`)
    }

    return data?.pinned || false
  }

  /**
   * Check if a task is completed
   */
  async isTaskCompleted(user_id: string, task_id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('task_states')
      .select('completed')
      .eq('user_id', user_id)
      .eq('task_id', task_id)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check if task is completed: ${error.message}`)
    }

    return data?.completed || false
  }
}