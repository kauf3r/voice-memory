'use client'

import React, { useState, useEffect } from 'react'

interface AnalysisMetrics {
  totalAnalyses: number
  avgConfidence: number
  cacheHitRate: number
  avgProcessingTime: number
  costSavings: number
}

export default function AnalysisDashboard() {
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analysis/metrics')
      
      if (!response.ok) {
        throw new Error('Failed to load metrics')
      }
      
      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading analysis metrics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-red-600">⚠️</div>
          <div>
            <h3 className="font-medium text-red-800">Error loading dashboard</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No metrics available</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">AI Analysis Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Analyses</h3>
          <p className="text-3xl font-bold text-blue-600">{metrics.totalAnalyses}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Average Confidence</h3>
          <p className="text-3xl font-bold text-green-600">
            {(metrics.avgConfidence * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Cache Hit Rate</h3>
          <p className="text-3xl font-bold text-purple-600">
            {(metrics.cacheHitRate * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Processing Time</h3>
          <p className="text-3xl font-bold text-orange-600">
            {(metrics.avgProcessingTime / 1000).toFixed(1)}s
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Cost Savings</h3>
          <p className="text-3xl font-bold text-red-600">
            {(metrics.costSavings * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">System Status</h3>
          <p className="text-3xl font-bold text-green-600">✅ Healthy</p>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={loadMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  )
}