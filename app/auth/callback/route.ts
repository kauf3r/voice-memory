import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: {
            getItem: (key: string) => {
              return cookieStore.get(key)?.value
            },
            setItem: (key: string, value: string) => {
              cookieStore.set(key, value, {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: 'lax',
              })
            },
            removeItem: (key: string) => {
              cookieStore.delete(key)
            },
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/', request.url))
}