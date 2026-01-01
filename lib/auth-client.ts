/**
 * Client-side authentication utilities
 * Safe to use in client components and browser environments
 *
 * NOTE: This is for UI display purposes only. All admin access
 * must be verified server-side using lib/auth-server.ts
 */

interface User {
  id: string
  email?: string
  user_metadata?: any
  app_metadata?: any
}

/**
 * Get admin emails from environment (client-safe)
 * Uses NEXT_PUBLIC_ADMIN_EMAILS for client-side availability
 */
function getClientAdminEmails(): string[] {
  const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? ''
  if (!adminEmailsEnv) return []

  return adminEmailsEnv
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0 && email.includes('@'))
}

/**
 * Client-safe admin user checking
 * This function only checks basic user properties available on the client
 *
 * IMPORTANT: This is for UI purposes only. Server-side validation is required
 * for any actual admin operations.
 */
export function isAdminUser(user?: User | null): boolean {
  if (!user) {
    return false
  }

  // Check if user has admin role in user_metadata or app_metadata
  const isAdminInUserMeta = user.user_metadata?.role === 'admin' || user.user_metadata?.admin === true
  const isAdminInAppMeta = user.app_metadata?.role === 'admin' || user.app_metadata?.admin === true

  // Check if user email is in admin list (from environment variable)
  const adminEmails = getClientAdminEmails()
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