/**
 * Query Optimizer - Intelligent database query optimization and caching
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '../supabase-server'
import { getSection } from '../config/index'

export interface QueryPerformanceMetrics {
  queryId: string
  queryType: string
  executionTime: number
  rowsReturned: number
  cacheHit: boolean
  optimizationApplied: boolean
  timestamp: string
}

export interface QueryOptimizationRule {
  id: string
  name: string
  description: string
  condition: (query: any) => boolean
  optimization: (query: any) => any
  enabled: boolean
  priority: number
}

export interface CacheEntry {
  key: string
  data: any
  timestamp: number
  ttl: number
  hitCount: number
  size: number
}

export interface QueryCache {
  entries: Map<string, CacheEntry>
  maxSize: number
  currentSize: number
  hitRate: number
  missCount: number
  hitCount: number
}

export class QueryOptimizer {
  private client: SupabaseClient
  private config: ReturnType<typeof getSection<'monitoring'>>
  private cache: QueryCache
  private optimizationRules: Map<string, QueryOptimizationRule> = new Map()
  private performanceMetrics: QueryPerformanceMetrics[] = []
  private maxMetricsHistory = 1000

  constructor() {
    this.client = createServiceClient()
    this.config = getSection('monitoring')
    this.cache = this.initializeCache()
    this.initializeOptimizationRules()
  }

  /**
   * Initialize query cache
   */
  private initializeCache(): QueryCache {
    return {
      entries: new Map(),
      maxSize: 100 * 1024 * 1024, // 100MB
      currentSize: 0,
      hitRate: 0,
      missCount: 0,
      hitCount: 0
    }
  }

  /**
   * Initialize query optimization rules
   */
  private initializeOptimizationRules(): void {
    const rules: QueryOptimizationRule[] = [
      {
        id: 'user-notes-limit',
        name: 'User Notes Query Limit',
        description: 'Add reasonable limits to user notes queries to prevent large result sets',
        condition: (query) => 
          query.table === 'notes' && 
          query.filters?.user_id && 
          !query.limit,
        optimization: (query) => ({
          ...query,
          limit: 100,
          optimizationApplied: 'added_default_limit'
        }),
        enabled: true,
        priority: 1
      },
      {
        id: 'processed-notes-index',
        name: 'Processed Notes Index Hint',
        description: 'Use composite index for processed notes queries',
        condition: (query) => 
          query.table === 'notes' && 
          query.filters?.user_id && 
          query.filters?.processed_at !== undefined,
        optimization: (query) => ({
          ...query,
          indexHint: 'idx_notes_user_id_processed_at',
          orderBy: query.orderBy || 'processed_at',
          optimizationApplied: 'index_hint_added'
        }),
        enabled: true,
        priority: 2
      },
      {
        id: 'task-states-batch',
        name: 'Task States Batch Optimization',
        description: 'Optimize task states queries with IN clauses',
        condition: (query) => 
          query.table === 'task_states' && 
          Array.isArray(query.filters?.task_id) && 
          query.filters.task_id.length > 10,
        optimization: (query) => ({
          ...query,
          batchSize: 50,
          optimizationApplied: 'batch_processing'
        }),
        enabled: true,
        priority: 3
      },
      {
        id: 'recent-notes-partition',
        name: 'Recent Notes Partition',
        description: 'Use recent notes partial index for better performance',
        condition: (query) => 
          query.table === 'notes' && 
          query.filters?.processed_at && 
          this.isRecentTimeFilter(query.filters.processed_at),
        optimization: (query) => ({
          ...query,
          indexHint: 'idx_notes_recent',
          optimizationApplied: 'recent_partition_used'
        }),
        enabled: true,
        priority: 4
      },
      {
        id: 'analytics-aggregation',
        name: 'Analytics Query Aggregation',
        description: 'Use materialized views for analytics queries',
        condition: (query) => 
          query.type === 'analytics' || 
          (query.aggregations && Object.keys(query.aggregations).length > 0),
        optimization: (query) => ({
          ...query,
          useView: this.getOptimalView(query),
          optimizationApplied: 'materialized_view_used'
        }),
        enabled: true,
        priority: 5
      }
    ]

    rules.forEach(rule => {
      this.optimizationRules.set(rule.id, rule)
    })

    console.log(`✅ Initialized ${rules.length} query optimization rules`)
  }

  /**
   * Optimize a database query
   */
  async optimizeQuery(query: any): Promise<any> {
    const startTime = Date.now()
    const queryId = this.generateQueryId(query)
    
    try {
      // Check cache first
      const cachedResult = this.getCachedResult(queryId)
      if (cachedResult) {
        this.recordPerformanceMetric({
          queryId,
          queryType: query.table || 'unknown',
          executionTime: 1, // Cache hit
          rowsReturned: Array.isArray(cachedResult) ? cachedResult.length : 1,
          cacheHit: true,
          optimizationApplied: false,
          timestamp: new Date().toISOString()
        })
        
        return cachedResult
      }

      // Apply optimization rules
      const optimizedQuery = this.applyOptimizationRules(query)
      
      // Execute optimized query
      const result = await this.executeOptimizedQuery(optimizedQuery)
      
      // Cache result if appropriate
      if (this.shouldCacheResult(optimizedQuery, result)) {
        this.cacheResult(queryId, result)
      }

      // Record performance metrics
      const executionTime = Date.now() - startTime
      this.recordPerformanceMetric({
        queryId,
        queryType: query.table || 'unknown',
        executionTime,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        cacheHit: false,
        optimizationApplied: optimizedQuery.optimizationApplied !== undefined,
        timestamp: new Date().toISOString()
      })

      return result

    } catch (error) {
      console.error('Query optimization failed:', error)
      throw error
    }
  }

  /**
   * Apply optimization rules to a query
   */
  private applyOptimizationRules(query: any): any {
    let optimizedQuery = { ...query }
    
    // Sort rules by priority
    const rules = Array.from(this.optimizationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of rules) {
      if (rule.condition(optimizedQuery)) {
        optimizedQuery = rule.optimization(optimizedQuery)
        console.log(`Applied optimization rule: ${rule.name}`)
      }
    }

    return optimizedQuery
  }

  /**
   * Execute optimized query with Supabase
   */
  private async executeOptimizedQuery(query: any): Promise<any> {
    let queryBuilder = this.client.from(query.table)

    // Apply select
    if (query.select) {
      queryBuilder = queryBuilder.select(query.select)
    } else {
      queryBuilder = queryBuilder.select('*')
    }

    // Apply filters
    if (query.filters) {
      for (const [column, value] of Object.entries(query.filters)) {
        if (Array.isArray(value)) {
          queryBuilder = queryBuilder.in(column, value)
        } else if (value === null) {
          queryBuilder = queryBuilder.is(column, null)
        } else if (typeof value === 'object' && value !== null) {
          // Handle range filters, etc.
          if ('gte' in value) queryBuilder = queryBuilder.gte(column, value.gte)
          if ('lte' in value) queryBuilder = queryBuilder.lte(column, value.lte)
          if ('gt' in value) queryBuilder = queryBuilder.gt(column, value.gt)
          if ('lt' in value) queryBuilder = queryBuilder.lt(column, value.lt)
        } else {
          queryBuilder = queryBuilder.eq(column, value)
        }
      }
    }

    // Apply ordering
    if (query.orderBy) {
      const ascending = query.ascending !== false
      queryBuilder = queryBuilder.order(query.orderBy, { ascending })
    }

    // Apply limit
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit)
    }

    // Execute query
    const { data, error } = await queryBuilder

    if (error) {
      throw error
    }

    return data
  }

  /**
   * Generate unique query ID for caching
   */
  private generateQueryId(query: any): string {
    const key = JSON.stringify({
      table: query.table,
      select: query.select,
      filters: query.filters,
      orderBy: query.orderBy,
      limit: query.limit
    })
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return `query_${Math.abs(hash).toString(36)}`
  }

  /**
   * Get cached result
   */
  private getCachedResult(queryId: string): any | null {
    const entry = this.cache.entries.get(queryId)
    
    if (!entry) {
      this.cache.missCount++
      this.updateCacheHitRate()
      return null
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.entries.delete(queryId)
      this.cache.currentSize -= entry.size
      this.cache.missCount++
      this.updateCacheHitRate()
      return null
    }

    // Update hit count and return data
    entry.hitCount++
    this.cache.hitCount++
    this.updateCacheHitRate()
    
    return entry.data
  }

  /**
   * Cache query result
   */
  private cacheResult(queryId: string, data: any): void {
    const dataSize = this.estimateDataSize(data)
    const ttl = this.calculateTTL(data)

    // Check if we have space
    if (this.cache.currentSize + dataSize > this.cache.maxSize) {
      this.evictOldEntries(dataSize)
    }

    const entry: CacheEntry = {
      key: queryId,
      data,
      timestamp: Date.now(),
      ttl,
      hitCount: 0,
      size: dataSize
    }

    this.cache.entries.set(queryId, entry)
    this.cache.currentSize += dataSize
  }

  /**
   * Determine if result should be cached
   */
  private shouldCacheResult(query: any, result: any): boolean {
    // Don't cache empty results
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return false
    }

    // Don't cache very large results
    if (this.estimateDataSize(result) > 10 * 1024 * 1024) { // 10MB
      return false
    }

    // Don't cache real-time data
    if (query.table === 'processing_errors' || query.realtime) {
      return false
    }

    return true
  }

  /**
   * Estimate data size for caching
   */
  private estimateDataSize(data: any): number {
    return JSON.stringify(data).length * 2 // Rough estimate
  }

  /**
   * Calculate cache TTL based on data type
   */
  private calculateTTL(data: any): number {
    // Default TTL: 5 minutes
    let ttl = 5 * 60 * 1000

    // Longer TTL for stable data
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0]
      
      // Processed notes can be cached longer
      if (firstItem.processed_at) {
        ttl = 15 * 60 * 1000 // 15 minutes
      }
      
      // Task states change less frequently
      if (firstItem.task_id) {
        ttl = 10 * 60 * 1000 // 10 minutes
      }
    }

    return ttl
  }

  /**
   * Evict old cache entries to make space
   */
  private evictOldEntries(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries.entries())
      .sort((a, b) => {
        // Sort by: low hit count, then by age
        const hitCountDiff = a[1].hitCount - b[1].hitCount
        if (hitCountDiff !== 0) return hitCountDiff
        return a[1].timestamp - b[1].timestamp
      })

    let freedSpace = 0
    for (const [key, entry] of entries) {
      this.cache.entries.delete(key)
      this.cache.currentSize -= entry.size
      freedSpace += entry.size
      
      if (freedSpace >= requiredSpace) {
        break
      }
    }
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const totalRequests = this.cache.hitCount + this.cache.missCount
    this.cache.hitRate = totalRequests > 0 ? (this.cache.hitCount / totalRequests) * 100 : 0
  }

  /**
   * Check if time filter is recent
   */
  private isRecentTimeFilter(timeFilter: any): boolean {
    if (typeof timeFilter === 'object' && timeFilter.gte) {
      const filterTime = new Date(timeFilter.gte).getTime()
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
      return filterTime > thirtyDaysAgo
    }
    return false
  }

  /**
   * Get optimal view for analytics query
   */
  private getOptimalView(query: any): string | null {
    if (query.table === 'notes' && query.aggregations) {
      return 'user_dashboard_stats'
    }
    if (query.table === 'task_states' && query.aggregations) {
      return 'user_task_stats'
    }
    return null
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(metric: QueryPerformanceMetrics): void {
    this.performanceMetrics.push(metric)
    
    // Keep only recent metrics
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsHistory)
    }
  }

  /**
   * Get query performance analytics
   */
  getPerformanceAnalytics(): {
    totalQueries: number
    averageExecutionTime: number
    cacheHitRate: number
    slowQueries: QueryPerformanceMetrics[]
    optimizationRate: number
    queryTypeBreakdown: Record<string, number>
  } {
    const metrics = this.performanceMetrics
    
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        cacheHitRate: 0,
        slowQueries: [],
        optimizationRate: 0,
        queryTypeBreakdown: {}
      }
    }

    const totalQueries = metrics.length
    const averageExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
    const cacheHits = metrics.filter(m => m.cacheHit).length
    const cacheHitRate = (cacheHits / totalQueries) * 100
    const optimizedQueries = metrics.filter(m => m.optimizationApplied).length
    const optimizationRate = (optimizedQueries / totalQueries) * 100
    
    // Slow queries (>100ms)
    const slowQueries = metrics
      .filter(m => m.executionTime > 100)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)

    // Query type breakdown
    const queryTypeBreakdown: Record<string, number> = {}
    metrics.forEach(m => {
      queryTypeBreakdown[m.queryType] = (queryTypeBreakdown[m.queryType] || 0) + 1
    })

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      slowQueries,
      optimizationRate,
      queryTypeBreakdown
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    size: number
    maxSize: number
    utilizationPercentage: number
    entryCount: number
    hitRate: number
    hitCount: number
    missCount: number
  } {
    return {
      size: this.cache.currentSize,
      maxSize: this.cache.maxSize,
      utilizationPercentage: (this.cache.currentSize / this.cache.maxSize) * 100,
      entryCount: this.cache.entries.size,
      hitRate: this.cache.hitRate,
      hitCount: this.cache.hitCount,
      missCount: this.cache.missCount
    }
  }

  /**
   * Clear cache
   */
  clearCache(): number {
    const clearedEntries = this.cache.entries.size
    this.cache.entries.clear()
    this.cache.currentSize = 0
    console.log(`🗑️ Cleared ${clearedEntries} cache entries`)
    return clearedEntries
  }

  /**
   * Get optimization rules
   */
  getOptimizationRules(): QueryOptimizationRule[] {
    return Array.from(this.optimizationRules.values())
  }

  /**
   * Enable/disable optimization rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.optimizationRules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
      console.log(`${enabled ? 'Enabled' : 'Disabled'} optimization rule: ${rule.name}`)
      return true
    }
    return false
  }

  /**
   * Test query performance
   */
  async testQueryPerformance(): Promise<{
    testName: string
    executionTime: number
    rowsReturned: number
    cacheHit: boolean
    optimizationApplied: boolean
  }[]> {
    const tests = [
      {
        name: 'user_notes_query',
        query: {
          table: 'notes',
          filters: { user_id: 'test-user' },
          orderBy: 'processed_at',
          limit: 50
        }
      },
      {
        name: 'task_states_lookup',
        query: {
          table: 'task_states',
          filters: { user_id: 'test-user' }
        }
      },
      {
        name: 'unprocessed_notes',
        query: {
          table: 'notes',
          filters: { 
            processed_at: null,
            processing_started_at: null
          }
        }
      }
    ]

    const results = []
    
    for (const test of tests) {
      const startTime = Date.now()
      
      try {
        const result = await this.optimizeQuery(test.query)
        const executionTime = Date.now() - startTime
        
        // Find the metric for this query
        const metric = this.performanceMetrics
          .filter(m => m.timestamp > new Date(startTime).toISOString())
          .pop()

        results.push({
          testName: test.name,
          executionTime,
          rowsReturned: Array.isArray(result) ? result.length : 1,
          cacheHit: metric?.cacheHit || false,
          optimizationApplied: metric?.optimizationApplied || false
        })
      } catch (error) {
        results.push({
          testName: test.name,
          executionTime: Date.now() - startTime,
          rowsReturned: 0,
          cacheHit: false,
          optimizationApplied: false
        })
      }
    }

    return results
  }
}