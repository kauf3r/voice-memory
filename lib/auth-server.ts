/**
 * Server-side authentication utilities
 * Only use this in API routes and server components
 */

import { createServiceClient } from './supabase-server'
import { isAdminEmail, getAdminUserIds } from './admin-config'

export async function getUser() {
  try {
    const supabase = createServiceClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

interface User {
  id: string
  email?: string
  user_metadata?: any
  app_metadata?: any
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false

  // Check admin email list (from environment variable)
  if (isAdminEmail(user.email)) {
    return true
  }

  // Check specific admin user IDs (from environment variable)
  const adminUserIds = getAdminUserIds()
  if (adminUserIds.includes(user.id)) {
    return true
  }

  // Check for admin role in metadata
  if (user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin') {
    return true
  }

  return false
}

export async function requireAdminUser() {
  const user = await getUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  
  if (!isAdminUser(user)) {
    throw new Error('Admin access required')
  }
  
  return user
}