// Authentication debugging utilities

const AUTH_DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true'

export class AuthDebugger {
  static enabled = AUTH_DEBUG

  static log(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`🔐 [AUTH] ${message}`, ...args)
    }
  }

  static error(message: string, error?: any) {
    if (this.enabled) {
      console.error(`❌ [AUTH ERROR] ${message}`, error)
    }
  }

  static warn(message: string, ...args: any[]) {
    if (this.enabled) {
      console.warn(`⚠️ [AUTH WARNING] ${message}`, ...args)
    }
  }

  static success(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`✅ [AUTH SUCCESS] ${message}`, ...args)
    }
  }

  static info(message: string, ...args: any[]) {
    if (this.enabled) {
      console.info(`ℹ️ [AUTH INFO] ${message}`, ...args)
    }
  }

  static debugUrl() {
    if (!this.enabled || typeof window === 'undefined') return

    const url = window.location.href
    const hasHash = window.location.hash.length > 0
    const hasAuthTokens = window.location.hash.includes('access_token')
    
    this.log('URL Debug:', {
      url,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      hasHash,
      hasAuthTokens
    })

    if (hasAuthTokens) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const tokenType = hashParams.get('token_type')
        const expiresIn = hashParams.get('expires_in')
        
        this.log('Auth Tokens Found:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          tokenType,
          expiresIn,
          accessTokenLength: accessToken?.length || 0,
          refreshTokenLength: refreshToken?.length || 0
        })
      } catch (error) {
        this.error('Failed to parse URL hash tokens', error)
      }
    }
  }

  static debugSession(session: any) {
    if (!this.enabled) return

    if (session) {
      this.log('Session Debug:', {
        userId: session.user?.id,
        email: session.user?.email,
        accessTokenLength: session.access_token?.length || 0,
        refreshTokenLength: session.refresh_token?.length || 0,
        expiresAt: session.expires_at,
        providerToken: !!session.provider_token,
        providerRefreshToken: !!session.provider_refresh_token
      })
    } else {
      this.log('No session found')
    }
  }

  static debugAuthState(event: string, session: any) {
    if (!this.enabled) return

    this.log(`Auth State Change: ${event}`, {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      timestamp: new Date().toISOString()
    })
  }

  static enable() {
    this.enabled = true
    this.log('Debug logging enabled')
  }

  static disable() {
    this.enabled = false
  }
}

// Global debug function for easy console access
if (typeof window !== 'undefined') {
  (window as any).authDebug = AuthDebugger
}