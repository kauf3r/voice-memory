/**
 * Background Jobs Management API
 * 
 * Provides endpoints for managing background jobs, monitoring performance,
 * and controlling the background job processor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processingService } from '@/lib/processing/ProcessingService'
import { requireAdminUser } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdminUser()

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    const backgroundJobProcessor = processingService.getBackgroundJobProcessor()

    switch (action) {
      case 'stats':
        // Get queue statistics
        const queueStats = backgroundJobProcessor.getQueueStatistics()
        return NextResponse.json({
          success: true,
          data: queueStats
        })

      case 'jobs':
        // Get jobs by status
        const status = url.searchParams.get('status') as any
        const jobs = status 
          ? backgroundJobProcessor.getJobsByStatus(status)
          : Array.from(backgroundJobProcessor['queue'].jobs.values())
        
        return NextResponse.json({
          success: true,
          data: jobs.slice(0, 50) // Limit to 50 jobs
        })

      case 'job':
        // Get specific job
        const jobId = url.searchParams.get('jobId')
        if (!jobId) {
          return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
        }
        
        const job = backgroundJobProcessor.getJob(jobId)
        return NextResponse.json({
          success: true,
          data: job
        })

      default:
        return NextResponse.json({
          success: true,
          data: {
            message: 'Background Jobs API',
            availableActions: ['stats', 'jobs', 'job'],
            documentation: {
              stats: 'GET /api/admin/background-jobs?action=stats',
              jobs: 'GET /api/admin/background-jobs?action=jobs&status=pending',
              job: 'GET /api/admin/background-jobs?action=job&jobId=xxx',
              schedule: 'POST /api/admin/background-jobs',
              cancel: 'DELETE /api/admin/background-jobs?jobId=xxx'
            }
          }
        })
    }

  } catch (error) {
    console.error('Background jobs API error:', error)
    
    // Handle authorization errors
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process background jobs request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdminUser()

    const body = await request.json()
    const { type, payload = {}, priority = 5, scheduledAt } = body

    // Validate job type
    const validTypes = ['batch_processing', 'cleanup', 'analytics', 'maintenance', 'migration']
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        error: 'Invalid job type',
        validTypes
      }, { status: 400 })
    }

    const backgroundJobProcessor = processingService.getBackgroundJobProcessor()
    const jobId = await backgroundJobProcessor.addJob(
      type,
      payload,
      priority,
      scheduledAt ? new Date(scheduledAt) : undefined
    )

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        type,
        priority,
        scheduledAt: scheduledAt || new Date().toISOString(),
        message: `${type} job scheduled successfully`
      }
    })

  } catch (error) {
    console.error('Failed to schedule background job:', error)
    
    // Handle authorization errors
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to schedule background job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdminUser()

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const backgroundJobProcessor = processingService.getBackgroundJobProcessor()
    const cancelled = backgroundJobProcessor.cancelJob(jobId)

    if (cancelled) {
      return NextResponse.json({
        success: true,
        data: {
          jobId,
          message: 'Job cancelled successfully'
        }
      })
    } else {
      return NextResponse.json({
        error: 'Failed to cancel job',
        details: 'Job may not exist, be running, or already completed'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Failed to cancel background job:', error)
    
    // Handle authorization errors
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel background job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdminUser()

    const body = await request.json()
    const { action, ...params } = body

    const backgroundJobProcessor = processingService.getBackgroundJobProcessor()

    switch (action) {
      case 'process_pending':
        // Force process all pending jobs
        await backgroundJobProcessor.processPendingJobs()
        return NextResponse.json({
          success: true,
          data: {
            message: 'Force processed all pending jobs'
          }
        })

      case 'update_config':
        // Update batch processing configuration
        const { batchConfig } = params
        if (batchConfig) {
          backgroundJobProcessor.updateBatchConfig(batchConfig)
          return NextResponse.json({
            success: true,
            data: {
              message: 'Batch configuration updated',
              config: batchConfig
            }
          })
        }
        return NextResponse.json({ error: 'Batch config required' }, { status: 400 })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['process_pending', 'update_config']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Failed to update background jobs:', error)
    
    // Handle authorization errors
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update background jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}