import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Dev-only authentication endpoint for automated testing
// This route only works in development mode

const TEST_USER_EMAIL = 'test@voicememory.dev'
const TEST_USER_PASSWORD = 'test-password-dev-only-12345'

export async function GET() {
  // SECURITY: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 404 }
    )
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    // Create admin client with service role
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Try to sign in existing test user first
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    })

    if (signInData?.session) {
      console.log('🔐 Dev auth: Signed in existing test user')
      return NextResponse.json({
        success: true,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_at: signInData.session.expires_at,
        },
        user: {
          id: signInData.user?.id,
          email: signInData.user?.email,
        },
      })
    }

    // If sign in failed, try to create the test user
    if (signInError?.message?.includes('Invalid login credentials')) {
      console.log('🔐 Dev auth: Creating new test user...')

      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        email_confirm: true, // Auto-confirm email
      })

      if (createError) {
        console.error('Failed to create test user:', createError)
        return NextResponse.json(
          { error: 'Failed to create test user', details: createError.message },
          { status: 500 }
        )
      }

      // Now sign in the newly created user
      const { data: newSignIn, error: newSignInError } = await adminClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      })

      if (newSignInError || !newSignIn?.session) {
        return NextResponse.json(
          { error: 'Failed to sign in new test user', details: newSignInError?.message },
          { status: 500 }
        )
      }

      console.log('🔐 Dev auth: Created and signed in new test user')
      return NextResponse.json({
        success: true,
        session: {
          access_token: newSignIn.session.access_token,
          refresh_token: newSignIn.session.refresh_token,
          expires_at: newSignIn.session.expires_at,
        },
        user: {
          id: newSignIn.user?.id,
          email: newSignIn.user?.email,
        },
      })
    }

    // Some other error
    return NextResponse.json(
      { error: 'Authentication failed', details: signInError?.message },
      { status: 500 }
    )

  } catch (error) {
    console.error('Dev auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// POST endpoint to set session via cookies (for browser-based testing)
export async function POST() {
  // Just redirect to GET for simplicity
  return GET()
}
