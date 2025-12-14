import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  KnowledgeService,
  AuthenticationService,
  CacheManager,
  ErrorHandler
} from '@/lib/services'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Knowledge API - GET request started')
  console.log('📊 Environment check:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const authContext = await AuthenticationService.authenticateFromHeader(authHeader)

    // Create knowledge service
    const knowledgeService = new KnowledgeService(authContext)

    // Get complete knowledge with all data
    const knowledgeResponse = await knowledgeService.getCompleteKnowledge({
      includeProjectKnowledge: true,
      maxInsights: 50,
      maxTimelineItems: 20,
      maxSentimentTrends: 30
    })

    console.log('📤 Returning knowledge response with stats:', {
      totalNotes: knowledgeResponse.knowledge.stats.totalNotes,
      totalInsights: knowledgeResponse.knowledge.stats.totalInsights,
      totalTasks: knowledgeResponse.knowledge.stats.totalTasks,
      hasContent: !!knowledgeResponse.knowledge.content,
      contentKeys: knowledgeResponse.knowledge.content ? Object.keys(knowledgeResponse.knowledge.content) : []
    })

    // Get last modified date for caching
    const lastModified = await knowledgeService.getLastModified()

    // Return cached response with appropriate headers
    return CacheManager.createCachedResponse(
      knowledgeResponse,
      [{ processed_at: lastModified.toISOString() } as any],
      request.headers
    )

  } catch (error) {
    console.error('Knowledge API error:', error)
    
    // Handle specific error types
    if (error.message?.includes('Authorization')) {
      return ErrorHandler.handleAuthError(error)
    }
    
    return ErrorHandler.handleServiceError(error, 'Knowledge API')
  }
}

export async function PUT(request: NextRequest) {
  console.log('💾 Knowledge API - PUT request started')
  
  try {
    // Get request body
    const body = await request.json()
    const { content } = body

    // Validate request data
    if (!content || typeof content !== 'object') {
      return ErrorHandler.handleValidationError(new Error('Invalid content provided'))
    }

    // Authenticate user with fallback support
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const supabase = await createServerClient()
    
    const authContext = await AuthenticationService.authenticateWithFallback(authHeader, supabase)

    // Create knowledge service
    const knowledgeService = new KnowledgeService(authContext)

    // Update project knowledge
    const result = await knowledgeService.updateProjectKnowledge(content)

    console.log('✅ Project knowledge updated successfully')
    return NextResponse.json(result)

  } catch (error) {
    console.error('Knowledge update API error:', error)
    
    // Handle specific error types
    if (error.message?.includes('Unauthorized') || error.message?.includes('Authorization')) {
      return ErrorHandler.handleAuthError(error)
    }
    
    if (error.message?.includes('Invalid')) {
      return ErrorHandler.handleValidationError(error)
    }
    
    return ErrorHandler.handleServiceError(error, 'Knowledge Update API')
  }
}

