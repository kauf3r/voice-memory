import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { quotaManager } from '@/lib/quota-manager'

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

    // Get quota status
    const quotaStatus = await quotaManager.getQuotaStatus(user.id)

    return NextResponse.json({
      success: true,
      ...quotaStatus
    })

  } catch (error) {
    console.error('Quota check error:', error)
    return NextResponse.json(
      { error: 'Failed to check quota' },
      { status: 500 }
    )
  }
}