/**
 * Server-side authentication utilities
 * Only use this in API routes and server components
 */

import { createServiceClient } from './supabase-server'

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
  
  // Check admin email domain
  if (user.email?.endsWith('@voicememory.test')) {
    return true
  }
  
  // Check specific admin user IDs
  const adminUserIds = [
    'admin-user-id' // Add specific admin user IDs here
  ]
  
  if (adminUserIds.includes(user.id)) {
    return true
  }
  
  // Check for admin role in metadata (future enhancement)
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