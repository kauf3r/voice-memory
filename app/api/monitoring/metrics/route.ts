import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

interface PerformanceMetric {
  name: string
  value: number
  timestamp: string
  context: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const metric: PerformanceMetric = await request.json()

    // Validate the metric
    if (!metric.name || typeof metric.value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metric format' },
        { status: 400 }
      )
    }

    // Store metric in database
    const supabase = createServerClient()
    const { error } = await supabase
      .from('performance_metrics')
      .insert({
        metric_name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        context: metric.context
      })

    if (error) {
      console.error('Failed to store metric in database:', error)
      return NextResponse.json(
        { error: 'Failed to store metric' },
        { status: 500 }
      )
    }

    // Check for performance threshold alerts
    await checkPerformanceThresholds(metric)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling metric:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const metricName = searchParams.get('name')
    const startTime = searchParams.get('start')
    const endTime = searchParams.get('end')
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = createServerClient()
    let query = supabase
      .from('performance_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (metricName) {
      query = query.eq('metric_name', metricName)
    }

    if (startTime) {
      query = query.gte('timestamp', startTime)
    }

    if (endTime) {
      query = query.lte('timestamp', endTime)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch metrics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      )
    }

    // Calculate aggregated statistics
    const stats = calculateMetricStats(data, metricName)

    return NextResponse.json({ 
      metrics: data,
      stats
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateMetricStats(metrics: any[], metricName?: string) {
  if (!metrics || metrics.length === 0) {
    return null
  }

  const values = metrics.map(m => m.value)
  const sum = values.reduce((a, b) => a + b, 0)
  const avg = sum / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  
  // Calculate percentiles
  const sorted = values.sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]

  return {
    count: values.length,
    sum,
    avg: Math.round(avg * 100) / 100,
    min,
    max,
    percentiles: {
      p50,
      p90,
      p95,
      p99
    }
  }
}

async function checkPerformanceThresholds(metric: PerformanceMetric) {
  const thresholds = {
    'FCP': 1800, // First Contentful Paint - 1.8s
    'LCP': 2500, // Largest Contentful Paint - 2.5s
    'TTI': 3800, // Time to Interactive - 3.8s
    'CLS': 0.1,  // Cumulative Layout Shift - 0.1
    'FID': 100,  // First Input Delay - 100ms
    'api_response_time': 5000, // API response time - 5s
    'transcription_time': 30000, // Transcription time - 30s
    'analysis_time': 10000 // AI analysis time - 10s
  }

  const threshold = thresholds[metric.name as keyof typeof thresholds]
  
  if (threshold && metric.value > threshold) {
    console.warn(`⚠️ Performance threshold exceeded for ${metric.name}:`, {
      value: metric.value,
      threshold,
      context: metric.context
    })

    // Store performance alert
    const supabase = createServerClient()
    await supabase
      .from('performance_alerts')
      .insert({
        metric_name: metric.name,
        value: metric.value,
        threshold,
        timestamp: metric.timestamp,
        context: metric.context
      })
  }
}