import { NextRequest, NextResponse } from 'next/server'
import { processingService } from '@/lib/processing-service'
import { isAuthorizedCronRequest, isVercelCronRequest, getAuthMethod } from '@/lib/cron-auth'

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5')

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    if (!isAuthorizedCronRequest(request, CRON_SECRET)) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting automated batch processing')

    // Get batch size from request body or use default
    const body = await request.json().catch(() => ({}))
    const batchSize = body.batchSize || BATCH_SIZE

    // Process the batch
    const result = await processingService.processNextBatch(batchSize)

    console.log('Automated batch processing completed:', result)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      batchSize,
      ...result
    })

  } catch (error) {
    console.error('Automated batch processing error:', error)
    
    return NextResponse.json(
      { 
        error: 'Batch processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// GET endpoint for health checks
export async function GET(request: NextRequest) {
  const isVercelCron = isVercelCronRequest(request)
  const isAuthorized = isAuthorizedCronRequest(request, CRON_SECRET)
  const authMethod = getAuthMethod(request, CRON_SECRET)
  
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    batchSize: BATCH_SIZE,
    cronSecretConfigured: !!CRON_SECRET,
    isVercelCron,
    isAuthorized,
    authMethod
  })
} 