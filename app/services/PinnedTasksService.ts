'use client'

export interface PinnedTask {
  taskId: string
  order: number
  pinned_at: string
}

export interface PinnedTasksResponse {
  success: boolean
  pinnedTasks: PinnedTask[]
  error?: string
}

export interface ApiResponse {
  success: boolean
  error?: string
}

export class PinnedTasksService {
  static async fetchPinnedTasks(accessToken: string): Promise<PinnedTasksResponse> {
    const response = await fetch('/api/tasks/pinned', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch pinned tasks')
    }

    const data = await response.json()
    return data
  }

  static async pinTask(taskId: string, accessToken: string): Promise<ApiResponse> {
    const response = await fetch(`/api/tasks/${taskId}/pin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to pin task')
    }

    return data
  }

  static async unpinTask(taskId: string, accessToken: string): Promise<ApiResponse> {
    const response = await fetch(`/api/tasks/${taskId}/pin`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to unpin task')
    }

    return data
  }

  static async reorderPin(
    taskId: string, 
    newIndex: number, 
    accessToken: string
  ): Promise<ApiResponse> {
    const response = await fetch('/api/tasks/reorder-pins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskId,
        newOrder: newIndex
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reorder pin')
    }

    return data
  }
}