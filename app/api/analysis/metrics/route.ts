import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getAnalysisMetrics, resetAnalysisMetrics } from '@/lib/openai'
import { processingService } from '@/lib/processing-service'

// GET /api/analysis/metrics - Get analysis performance metrics
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get analysis metrics
    const analysisMetrics = getAnalysisMetrics()
    
    // Get processing service metrics
    const processingMetrics = processingService.getSummaryMetrics()
    const circuitBreakerStatus = processingService.getCircuitBreakerStatus()
    const systemHealth = await processingService.getSystemHealthMetrics()

    // Get database stats for context
    const { data: noteStats } = await supabase
      .from('notes')
      .select('processed_at, analysis')
      .eq('user_id', user.id)

    const totalNotes = noteStats?.length || 0
    const processedNotes = noteStats?.filter(n => n.processed_at).length || 0
    const notesWithAnalysis = noteStats?.filter(n => n.analysis).length || 0

    // Calculate analysis quality metrics
    const analysisQualityMetrics = {
      completionRate: totalNotes > 0 ? (processedNotes / totalNotes) * 100 : 0,
      analysisRate: processedNotes > 0 ? (notesWithAnalysis / processedNotes) * 100 : 0,
      avgConfidence: 0, // Would need to extract from analysis metadata
      errorRate: analysisMetrics.errorRate * 100
    }

    const response = {
      timestamp: new Date().toISOString(),
      analysis: {
        ...analysisMetrics,
        cacheHitRate: analysisMetrics.cacheHitRate * 100,
        errorRate: analysisMetrics.errorRate * 100,
        averageCostPerRequest: Number(analysisMetrics.averageCostPerRequest.toFixed(6)),
        totalCost: Number(analysisMetrics.totalCost.toFixed(4))
      },
      processing: {
        ...processingMetrics,
        errorCategoryBreakdown: processingMetrics.errorCategoryBreakdown,
        successRate: Number(processingMetrics.successRate.toFixed(1)),
        averageProcessingTime: Number(processingMetrics.averageProcessingTime.toFixed(0))
      },
      circuitBreaker: circuitBreakerStatus,
      systemHealth: {
        status: systemHealth.healthStatus,
        currentlyProcessing: systemHealth.currentlyProcessing,
        stuckNotes: systemHealth.stuckNotes?.length || 0
      },
      database: {
        totalNotes,
        processedNotes,
        notesWithAnalysis,
        ...analysisQualityMetrics
      },
      recommendations: generateRecommendations(analysisMetrics, processingMetrics, circuitBreakerStatus)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching analysis metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/analysis/metrics - Reset metrics (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'reset') {
      resetAnalysisMetrics()
      
      return NextResponse.json({
        success: true,
        message: 'Analysis metrics reset successfully',
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error resetting analysis metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reset metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Generate actionable recommendations based on metrics
function generateRecommendations(
  analysisMetrics: any,
  processingMetrics: any,
  circuitBreakerStatus: any
): string[] {
  const recommendations: string[] = []

  // Cache optimization recommendations
  if (analysisMetrics.cacheHitRate < 0.3) {
    recommendations.push('Consider implementing more aggressive caching strategies to reduce API costs')
  }

  // Cost optimization recommendations
  if (analysisMetrics.averageCostPerRequest > 0.05) {
    recommendations.push('High analysis costs detected - consider using more GPT-3.5-turbo for simple content')
  }

  // Performance recommendations
  if (processingMetrics.averageProcessingTime > 30000) {
    recommendations.push('Processing times are high - consider optimizing audio preprocessing or using faster models')
  }

  // Error rate recommendations
  if (analysisMetrics.errorRate > 0.1) {
    recommendations.push('High analysis error rate - review prompt engineering and input validation')
  }

  // Circuit breaker recommendations
  if (circuitBreakerStatus.isOpen) {
    recommendations.push('Circuit breaker is open - check OpenAI API status and rate limits')
  } else if (circuitBreakerStatus.failures > 2) {
    recommendations.push('Recent API failures detected - monitor OpenAI service health')
  }

  // Model usage recommendations
  const gpt4Ratio = analysisMetrics.totalRequests > 0 ? 
    analysisMetrics.gpt4Requests / analysisMetrics.totalRequests : 0
  
  if (gpt4Ratio > 0.7) {
    recommendations.push('High GPT-4 usage - ensure complexity assessment is working correctly')
  } else if (gpt4Ratio < 0.2) {
    recommendations.push('Very low GPT-4 usage - consider if analysis quality might benefit from more advanced model usage')
  }

  // Success rate recommendations
  if (processingMetrics.successRate < 90) {
    recommendations.push('Processing success rate is below 90% - investigate common failure patterns')
  }

  return recommendations
}