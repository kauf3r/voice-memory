import { jest } from '@jest/globals'
import { quotaManager } from '@/lib/quota-manager'
import { createServiceClient } from '@/lib/supabase-server'

// Mock Supabase
jest.mock('@/lib/supabase-server')

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>

describe('Quota Manager', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      not: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      storage: {
        from: jest.fn().mockReturnThis(),
        list: jest.fn().mockResolvedValue({ 
          data: [], 
          error: null 
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue(mockSupabase)
  })

  describe('checkStorageQuota', () => {
    it('should return within limit for empty storage', async () => {
      const result = await quotaManager.checkStorageQuota('test-user')

      expect(result.withinLimit).toBe(true)
      expect(result.currentUsage).toBe(0)
      expect(result.limit).toBeGreaterThan(0)
    })

    it('should handle storage errors gracefully', async () => {
      mockSupabase.storage.list.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' }
      })

      const result = await quotaManager.checkStorageQuota('test-user')

      expect(result.withinLimit).toBe(true)
      expect(result.error).toBe('Storage error')
    })
  })

  describe('checkProcessingQuota', () => {
    it('should return within limit for no processing history', async () => {
      const result = await quotaManager.checkProcessingQuota('test-user')

      expect(result.withinLimit).toBe(true)
      expect(result.currentUsage).toBe(0)
      expect(result.limit).toBeGreaterThan(0)
    })

    it('should handle processing quota errors gracefully', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const result = await quotaManager.checkProcessingQuota('test-user')

      expect(result.withinLimit).toBe(true)
      expect(result.error).toBe('Database error')
    })
  })

  describe('updateStorageUsage', () => {
    it('should update storage usage without throwing', async () => {
      await expect(quotaManager.updateStorageUsage('test-user', 1024)).resolves.not.toThrow()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('user_quotas')
      expect(mockSupabase.upsert).toHaveBeenCalled()
    })

    it('should handle update errors gracefully', async () => {
      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      })

      await expect(quotaManager.updateStorageUsage('test-user', 1024)).resolves.not.toThrow()
    })
  })
})