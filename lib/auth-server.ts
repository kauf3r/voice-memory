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

export function isAdminUser(user: any): boolean {
  return user?.email?.endsWith('@voicememory.test') || 
         user?.id === 'admin-user-id' // Add specific admin user IDs here
}