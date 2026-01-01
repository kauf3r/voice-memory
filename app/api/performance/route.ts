import { NextRequest, NextResponse } from 'next/server'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  timestamp: number
  navigationType: string
  userAgent?: string
  url?: string
}

interface PerformanceReport {
  sessionId: string
  metrics: PerformanceMetric[]
  pageLoad?: {
    ttfb: number
    pageLoad: number
    domComplete: number
    transferSize: number
  }
  timestamp: number
}

// In-memory storage for demo purposes
// In production, you'd want to use a database or analytics service
const performanceData: PerformanceReport[] = []
const MAX_STORED_REPORTS = 1000

export async function POST(request: NextRequest) {
  try {
    const report: PerformanceReport = await request.json()
    
    // Add metadata
    report.timestamp = Date.now()
    
    // Add user agent and URL for analysis
    report.metrics.forEach(metric => {
      metric.userAgent = request.headers.get('user-agent') || undefined
      metric.url = request.headers.get('referer') || undefined
    })

    // Store the report
    performanceData.push(report)
    
    // Keep only the latest reports
    if (performanceData.length > MAX_STORED_REPORTS) {
      performanceData.splice(0, performanceData.length - MAX_STORED_REPORTS)
    }

    // Log performance issues for monitoring
    const poorMetrics = report.metrics.filter(m => m.rating === 'poor')
    if (poorMetrics.length > 0) {
      console.warn('Poor performance detected:', {
        sessionId: report.sessionId,
        poorMetrics: poorMetrics.map(m => ({ name: m.name, value: m.value })),
        userAgent: request.headers.get('user-agent'),
        url: request.headers.get('referer')
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Performance analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to process performance data' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const metricName = searchParams.get('metric')
    
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000)
    const recentReports = performanceData.filter(report => report.timestamp > cutoffTime)
    
    if (metricName) {
      // Get specific metric data
      const metricData = recentReports.flatMap(report => 
        report.metrics.filter(m => m.name === metricName)
      )
      
      return NextResponse.json({
        metric: metricName,
        dataPoints: metricData.map(m => ({
          value: m.value,
          rating: m.rating,
          timestamp: m.timestamp
        })),
        summary: calculateMetricSummary(metricData)
      })
    }

    // Return aggregated data
    const aggregatedData = {
      totalReports: recentReports.length,
      timeRange: `${hours}h`,
      metrics: aggregateMetrics(recentReports),
      performanceScore: calculateOverallScore(recentReports),
      trends: calculateTrends(recentReports),
      issues: identifyIssues(recentReports)
    }

    return NextResponse.json(aggregatedData)
  } catch (error) {
    console.error('Performance analytics query error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve performance data' },
      { status: 500 }
    )
  }
}

function calculateMetricSummary(metrics: PerformanceMetric[]) {
  if (metrics.length === 0) return null
  
  const values = metrics.map(m => m.value)
  const ratings = metrics.map(m => m.rating)
  
  return {
    count: metrics.length,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
    p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
    ratingDistribution: {
      good: ratings.filter(r => r === 'good').length,
      'needs-improvement': ratings.filter(r => r === 'needs-improvement').length,
      poor: ratings.filter(r => r === 'poor').length
    }
  }
}

function aggregateMetrics(reports: PerformanceReport[]) {
  const metricGroups: Record<string, PerformanceMetric[]> = {}
  
  reports.forEach(report => {
    report.metrics.forEach(metric => {
      if (!metricGroups[metric.name]) {
        metricGroups[metric.name] = []
      }
      metricGroups[metric.name].push(metric)
    })
  })
  
  const aggregated: Record<string, any> = {}
  Object.entries(metricGroups).forEach(([name, metrics]) => {
    aggregated[name] = calculateMetricSummary(metrics)
  })
  
  return aggregated
}

function calculateOverallScore(reports: PerformanceReport[]) {
  if (reports.length === 0) return 0
  
  const allMetrics = reports.flatMap(r => r.metrics)
  const scores = { good: 100, 'needs-improvement': 50, poor: 0 }
  
  const totalScore = allMetrics.reduce((sum, metric) => {
    return sum + scores[metric.rating]
  }, 0)
  
  return Math.round(totalScore / allMetrics.length)
}

function calculateTrends(reports: PerformanceReport[]) {
  // Simple trend calculation - compare first half vs second half
  const sorted = reports.sort((a, b) => a.timestamp - b.timestamp)
  const midpoint = Math.floor(sorted.length / 2)
  
  const firstHalf = sorted.slice(0, midpoint)
  const secondHalf = sorted.slice(midpoint)
  
  const firstScore = calculateOverallScore(firstHalf)
  const secondScore = calculateOverallScore(secondHalf)
  
  return {
    direction: secondScore > firstScore ? 'improving' : secondScore < firstScore ? 'declining' : 'stable',
    change: secondScore - firstScore,
    confidence: sorted.length > 20 ? 'high' : sorted.length > 10 ? 'medium' : 'low'
  }
}

function identifyIssues(reports: PerformanceReport[]) {
  const issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    description: string
    count: number
  }> = []
  
  const allMetrics = reports.flatMap(r => r.metrics)
  
  // Check for consistently poor metrics
  const metricGroups = allMetrics.reduce((acc, metric) => {
    if (!acc[metric.name]) acc[metric.name] = []
    acc[metric.name].push(metric)
    return acc
  }, {} as Record<string, PerformanceMetric[]>)
  
  Object.entries(metricGroups).forEach(([name, metrics]) => {
    const poorCount = metrics.filter(m => m.rating === 'poor').length
    const poorPercentage = (poorCount / metrics.length) * 100
    
    if (poorPercentage > 50) {
      issues.push({
        type: 'poor_metric',
        severity: 'high',
        description: `${name} is poor in ${poorPercentage.toFixed(1)}% of measurements`,
        count: poorCount
      })
    } else if (poorPercentage > 25) {
      issues.push({
        type: 'poor_metric',
        severity: 'medium',
        description: `${name} is poor in ${poorPercentage.toFixed(1)}% of measurements`,
        count: poorCount
      })
    }
  })
  
  // Check for slow page loads
  const slowLoads = reports.filter(r => r.pageLoad && r.pageLoad.pageLoad > 3000)
  if (slowLoads.length > reports.length * 0.1) {
    issues.push({
      type: 'slow_page_load',
      severity: 'medium',
      description: `${slowLoads.length} reports show page load times > 3 seconds`,
      count: slowLoads.length
    })
  }
  
  return issues
}