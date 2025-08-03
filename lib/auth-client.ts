/**
 * Client-side authentication utilities
 * Safe to use in client components and browser environments
 */

interface User {
  id: string
  email?: string
  user_metadata?: any
  app_metadata?: any
}

/**
 * Client-safe admin user checking
 * This function only checks basic user properties available on the client
 */
export function isAdminUser(user?: User | null): boolean {
  if (!user) {
    return false
  }

  // Check if user has admin role in user_metadata or app_metadata
  const isAdminInUserMeta = user.user_metadata?.role === 'admin' || user.user_metadata?.admin === true
  const isAdminInAppMeta = user.app_metadata?.role === 'admin' || user.app_metadata?.admin === true
  
  // Check if user email is in admin list (for development/testing)
  const adminEmails = [
    'andy@andykaufman.net',
    'admin@voice-memory.com'
  ]
  const isAdminEmail = user.email && adminEmails.includes(user.email.toLowerCase())

  return isAdminInUserMeta || isAdminInAppMeta || Boolean(isAdminEmail)
}

/**
 * Client-safe function to determine if a user has admin capabilities
 * This is for UI display purposes only - server-side validation still required
 */
export function hasAdminCapabilities(user?: User | null): boolean {
  return isAdminUser(user)
}

/**
 * Get user role for display purposes
 */
export function getUserRole(user?: User | null): 'admin' | 'user' | 'guest' {
  if (!user) return 'guest'
  if (isAdminUser(user)) return 'admin'
  return 'user'
}

/**
 * Check if user can access admin features
 * This is for UI purposes - always verify server-side
 */
export function canAccessAdminFeatures(user?: User | null): boolean {
  return isAdminUser(user)
}