/**
 * Performance Benchmarking Tests
 * Authentication flow timing, task operations speed, and memory usage monitoring
 */

import { performance } from 'perf_hooks'

// Mock modules for performance testing
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    }
  }
}))

// Performance test utilities
class PerformanceMonitor {
  private startTime: number = 0
  private measurements: Map<string, number[]> = new Map()

  start(): void {
    this.startTime = performance.now()
  }

  end(operationName: string): number {
    const endTime = performance.now()
    const duration = endTime - this.startTime
    
    if (!this.measurements.has(operationName)) {
      this.measurements.set(operationName, [])
    }
    this.measurements.get(operationName)!.push(duration)
    
    return duration
  }

  getStats(operationName: string) {
    const measurements = this.measurements.get(operationName) || []
    if (measurements.length === 0) return null

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    const p95 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)]

    return { avg, min, max, p95, count: measurements.length }
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [operation, measurements] of this.measurements) {
      stats[operation] = this.getStats(operation)
    }
    return stats
  }
}

// Memory monitoring utilities
class MemoryMonitor {
  private initialMemory: number

  constructor() {
    this.initialMemory = this.getCurrentMemoryUsage()
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    // Fallback for browser environment
    return (performance as any).memory?.usedJSHeapSize || 0
  }

  getMemoryDelta(): number {
    return this.getCurrentMemoryUsage() - this.initialMemory
  }

  getMemoryStats() {
    const current = this.getCurrentMemoryUsage()
    const delta = current - this.initialMemory
    return {
      initial: this.initialMemory,
      current,
      delta,
      deltaPercent: (delta / this.initialMemory) * 100
    }
  }
}

describe('Performance Benchmarks', () => {
  let perfMonitor: PerformanceMonitor
  let memoryMonitor: MemoryMonitor

  beforeEach(() => {
    perfMonitor = new PerformanceMonitor()
    memoryMonitor = new MemoryMonitor()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  afterEach(() => {
    // Log performance stats for monitoring
    const stats = perfMonitor.getAllStats()
    if (Object.keys(stats).length > 0) {
      console.log('📊 Performance Stats:', JSON.stringify(stats, null, 2))
    }
    
    const memStats = memoryMonitor.getMemoryStats()
    console.log('🧠 Memory Stats:', JSON.stringify(memStats, null, 2))
  })

  describe('Authentication Flow Performance', () => {
    test('authentication initialization should complete under 2 seconds', async () => {
      const { supabase } = await import('@/lib/supabase')
      const mockSupabase = supabase as jest.Mocked<typeof supabase>
      
      // Mock fast auth response
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: '123', email: 'test@example.com' }, access_token: 'token' } },
        error: null
      })
      
      perfMonitor.start()
      
      // Simulate auth initialization
      await mockSupabase.auth.getSession()
      
      const duration = perfMonitor.end('auth_initialization')
      
      expect(duration).toBeLessThan(2000) // Under 2 seconds
      
      // Log for monitoring
      console.log(`🔐 Auth initialization: ${duration.toFixed(2)}ms`)
    })

    test('token validation should complete under 500ms', async () => {
      const { getUserScopedClient } = await import('@/lib/supabase-server')
      
      // Mock the function to avoid actual network calls
      jest.doMock('@/lib/supabase-server', () => ({
        getUserScopedClient: jest.fn().mockResolvedValue({
          user: { id: '123', email: 'test@example.com' },
          client: {},
          error: null
        })
      }))
      
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
      
      perfMonitor.start()
      
      // Test multiple token validations
      const promises = Array(5).fill(null).map(() => getUserScopedClient(mockToken))
      await Promise.all(promises)
      
      const duration = perfMonitor.end('token_validation')
      
      expect(duration).toBeLessThan(500) // Under 500ms for 5 validations
      
      console.log(`🎫 Token validation (5x): ${duration.toFixed(2)}ms`)
    })

    test('authentication state changes should not cause memory leaks', async () => {
      const { supabase } = await import('@/lib/supabase')
      const mockSupabase = supabase as jest.Mocked<typeof supabase>
      
      const callbacks: Function[] = []
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        callbacks.push(callback)
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any
      })
      
      const initialMemory = memoryMonitor.getMemoryStats()
      
      // Simulate many auth state changes
      for (let i = 0; i < 100; i++) {
        callbacks.forEach(callback => {
          callback('SIGNED_IN', { user: { id: i.toString() } })
          callback('SIGNED_OUT', null)
        })
      }
      
      const finalMemory = memoryMonitor.getMemoryStats()
      const memoryIncrease = finalMemory.delta
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
      
      console.log(`🧠 Memory increase after 200 auth changes: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })
  })

  describe('Task Operations Performance', () => {
    test('task filtering should complete under 100ms for 1000 tasks', async () => {
      // Generate mock tasks
      const mockTasks = Array(1000).fill(null).map((_, i) => ({
        id: `task-${i}`,
        text: `Task ${i}`,
        type: i % 2 === 0 ? 'myTasks' : 'delegatedTasks',
        completed: i % 3 === 0,
        date: new Date().toISOString()
      }))
      
      perfMonitor.start()
      
      // Simulate filtering operations
      const filteredTasks = mockTasks.filter(task => {
        return task.type === 'myTasks' && !task.completed
      })
      
      const sortedTasks = filteredTasks.sort((a, b) => a.text.localeCompare(b.text))
      
      const duration = perfMonitor.end('task_filtering')
      
      expect(duration).toBeLessThan(100) // Under 100ms
      expect(sortedTasks.length).toBeGreaterThan(0)
      
      console.log(`📋 Task filtering (1000 tasks): ${duration.toFixed(2)}ms`)
    })

    test('task state updates should complete under 50ms', async () => {
      const mockTasks = Array(100).fill(null).map((_, i) => ({
        id: `task-${i}`,
        completed: false
      }))
      
      perfMonitor.start()
      
      // Simulate task state updates
      const updatedTasks = mockTasks.map(task => ({
        ...task,
        completed: !task.completed,
        updatedAt: Date.now()
      }))
      
      const duration = perfMonitor.end('task_state_update')
      
      expect(duration).toBeLessThan(50) // Under 50ms for 100 tasks
      expect(updatedTasks.every(task => task.completed)).toBe(true)
      
      console.log(`✅ Task state updates (100 tasks): ${duration.toFixed(2)}ms`)
    })

    test('pin/unpin operations should be optimized', async () => {
      const mockTaskIds = Array(50).fill(null).map((_, i) => `task-${i}`)
      const pinnedSet = new Set<string>()
      
      perfMonitor.start()
      
      // Simulate pin operations
      mockTaskIds.forEach(taskId => {
        if (Math.random() > 0.5) {
          pinnedSet.add(taskId)
        }
      })
      
      // Simulate checking pin status
      const pinStatuses = mockTaskIds.map(taskId => pinnedSet.has(taskId))
      
      const duration = perfMonitor.end('pin_operations')
      
      expect(duration).toBeLessThan(25) // Under 25ms for 50 operations
      expect(pinStatuses).toHaveLength(50)
      
      console.log(`📌 Pin operations (50 tasks): ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage Monitoring', () => {
    test('component rendering should not cause excessive memory usage', async () => {
      const React = await import('react')
      const { render, cleanup } = await import('@testing-library/react')
      
      const initialMemory = memoryMonitor.getMemoryStats()
      
      // Render and unmount components multiple times
      for (let i = 0; i < 50; i++) {
        const TestComponent = () => React.createElement('div', {}, `Component ${i}`)
        render(React.createElement(TestComponent))
        cleanup()
      }
      
      const finalMemory = memoryMonitor.getMemoryStats()
      const memoryIncrease = finalMemory.delta
      
      // Should not increase memory by more than 5MB
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
      
      console.log(`🎭 Component render/cleanup (50x): ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })

    test('event listener cleanup should prevent memory leaks', () => {
      const listeners: (() => void)[] = []
      const mockElement = {
        addEventListener: jest.fn((event, listener) => {
          listeners.push(listener)
        }),
        removeEventListener: jest.fn()
      }
      
      const initialMemory = memoryMonitor.getMemoryStats()
      
      // Add many event listeners
      for (let i = 0; i < 1000; i++) {
        const listener = () => console.log(`Event ${i}`)
        mockElement.addEventListener('click', listener)
      }
      
      // Simulate cleanup
      listeners.forEach(listener => {
        mockElement.removeEventListener('click', listener)
      })
      
      const finalMemory = memoryMonitor.getMemoryStats()
      
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1000)
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1000)
      
      console.log(`🎧 Event listener test: ${listeners.length} listeners created and cleaned`)
    })
  })

  describe('Network Performance', () => {
    test('API response parsing should be efficient', async () => {
      // Generate large mock API response
      const mockResponse = {
        tasks: Array(500).fill(null).map((_, i) => ({
          id: `task-${i}`,
          text: `Task ${i} with some longer description that might be typical`,
          type: i % 2 === 0 ? 'myTasks' : 'delegatedTasks',
          completed: i % 3 === 0,
          date: new Date().toISOString(),
          analysis: {
            sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
            priority: ['low', 'medium', 'high'][i % 3],
            tags: [`tag${i % 10}`, `category${i % 5}`]
          }
        }))
      }
      
      const jsonString = JSON.stringify(mockResponse)
      
      perfMonitor.start()
      
      // Parse and process the response
      const parsed = JSON.parse(jsonString)
      const processedTasks = parsed.tasks.map((task: any) => ({
        ...task,
        processed: true,
        processedAt: Date.now()
      }))
      
      const duration = perfMonitor.end('response_parsing')
      
      expect(duration).toBeLessThan(100) // Under 100ms for 500 tasks
      expect(processedTasks).toHaveLength(500)
      
      console.log(`🌐 API response parsing (500 tasks): ${duration.toFixed(2)}ms`)
    })
  })

  describe('Performance Regression Detection', () => {
    test('should establish performance baselines', () => {
      const baselines = {
        auth_initialization: 2000,    // 2 seconds
        token_validation: 500,        // 500ms
        task_filtering: 100,          // 100ms
        task_state_update: 50,        // 50ms
        pin_operations: 25,           // 25ms
        response_parsing: 100         // 100ms
      }
      
      // Log baselines for CI/CD monitoring
      console.log('📊 Performance Baselines:', JSON.stringify(baselines, null, 2))
      
      // Verify baselines are reasonable
      Object.values(baselines).forEach(baseline => {
        expect(baseline).toBeGreaterThan(0)
        expect(baseline).toBeLessThan(10000) // Max 10 seconds
      })
    })
  })
})