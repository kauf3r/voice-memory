import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

interface ErrorReport {
  id: string
  timestamp: string
  level: 'error' | 'warning' | 'info'
  message: string
  stack?: string
  context: {
    user_id?: string
    route: string
    component?: string
    browser?: string
    device?: string
    session_id?: string
  }
  metadata?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const errorReport: ErrorReport = await request.json()

    // Validate the error report
    if (!errorReport.message || !errorReport.id) {
      return NextResponse.json(
        { error: 'Invalid error report format' },
        { status: 400 }
      )
    }

    // Store error in database
    const supabase = createServerClient()
    const { error } = await supabase
      .from('error_logs')
      .insert({
        error_id: errorReport.id,
        timestamp: errorReport.timestamp,
        level: errorReport.level,
        message: errorReport.message,
        stack: errorReport.stack,
        user_id: errorReport.context.user_id,
        route: errorReport.context.route,
        component: errorReport.context.component,
        browser: errorReport.context.browser,
        device: errorReport.context.device,
        session_id: errorReport.context.session_id,
        metadata: errorReport.metadata
      })

    if (error) {
      console.error('Failed to store error in database:', error)
      return NextResponse.json(
        { error: 'Failed to store error' },
        { status: 500 }
      )
    }

    // Alert on critical errors
    if (errorReport.level === 'error') {
      await sendCriticalErrorAlert(errorReport)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling error report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const route = searchParams.get('route')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createServerClient()
    let query = supabase
      .from('error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (level) {
      query = query.eq('level', level)
    }

    if (route) {
      query = query.eq('route', route)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch error logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch error logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ errors: data })
  } catch (error) {
    console.error('Error fetching error logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function sendCriticalErrorAlert(errorReport: ErrorReport) {
  // In production, you might want to:
  // 1. Send to Slack/Discord webhook
  // 2. Send email alerts
  // 3. Create Jira tickets
  // 4. Send to external monitoring services (Sentry, DataDog, etc.)
  
  try {
    // Example: Log critical errors for now
    console.error('🚨 CRITICAL ERROR ALERT:', {
      message: errorReport.message,
      route: errorReport.context.route,
      user: errorReport.context.user_id,
      timestamp: errorReport.timestamp
    })

    // TODO: Implement actual alerting mechanisms
    // await sendSlackAlert(errorReport)
    // await sendEmailAlert(errorReport)
  } catch (error) {
    console.error('Failed to send critical error alert:', error)
  }
}