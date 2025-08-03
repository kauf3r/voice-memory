import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  
  return NextResponse.json({
    message: 'Auth test endpoint working',
    url: requestUrl.toString(),
    origin: requestUrl.origin,
    expectedCallbackUrl: `${requestUrl.origin}/auth/callback`,
    timestamp: new Date().toISOString()
  })
}