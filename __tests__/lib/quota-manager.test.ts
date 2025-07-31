import { QuotaManager } from '@/lib/quota-manager'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          gte: jest.fn(() => Promise.resolve({ count: 0 }))
        })),
        head: jest.fn(() => Promise.resolve({ count: 0 }))
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      upsert: jest.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}))

describe('QuotaManager', () => {
  let quotaManager: QuotaManager

  beforeEach(() => {
    quotaManager = new QuotaManager({
      maxNotesPerUser: 10,
      maxProcessingPerHour: 5,
      maxTokensPerDay: 1000,
      maxStorageMB: 100
    })
  })

  describe('checkUploadQuota', () => {
    test('allows upload when under limits', async () => {
      const result = await quotaManager.checkUploadQuota('user123')
      expect(result.allowed).toBe(true)
      expect(result.usage).toBeDefined()
      expect(result.limits).toBeDefined()
    })

    test('provides quota information', async () => {
      const result = await quotaManager.checkUploadQuota('user123')
      expect(result.usage.notesCount).toBe(0)
      expect(result.limits.maxNotesPerUser).toBe(10)
    })
  })

  describe('checkProcessingQuota', () => {
    test('allows processing when under limits', async () => {
      const result = await quotaManager.checkProcessingQuota('user123')
      expect(result.allowed).toBe(true)
    })
  })

  describe('recordTokenUsage', () => {
    test('records token usage without error', async () => {
      await expect(
        quotaManager.recordTokenUsage('user123', 100)
      ).resolves.not.toThrow()
    })
  })

  describe('recordProcessingAttempt', () => {
    test('records processing attempt without error', async () => {
      await expect(
        quotaManager.recordProcessingAttempt('user123')
      ).resolves.not.toThrow()
    })
  })

  describe('getQuotaStatus', () => {
    test('returns quota status with percentages', async () => {
      const status = await quotaManager.getQuotaStatus('user123')
      expect(status.usage).toBeDefined()
      expect(status.limits).toBeDefined()
      expect(status.percentages).toBeDefined()
      expect(status.percentages.notes).toBeGreaterThanOrEqual(0)
      expect(status.percentages.notes).toBeLessThanOrEqual(100)
    })
  })
})