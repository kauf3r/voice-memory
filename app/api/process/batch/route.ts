import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { batchSize = 5 } = body

    if (batchSize > 10) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 10' },
        { status: 400 }
      )
    }

    console.log(`Starting batch processing for user ${user.id} with batch size ${batchSize}`)

    const result = await processingService.processNextBatch(batchSize)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Batch processing completed: ${result.processed} successful, ${result.failed} failed`
    })

  } catch (error) {
    console.error('Batch processing API error:', error)
    return NextResponse.json(
      { error: 'Batch processing failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const stats = await processingService.getProcessingStats(user.id)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Processing stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to get processing stats' },
      { status: 500 }
    )
  }
}