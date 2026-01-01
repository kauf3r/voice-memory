/**
 * Client-safe authentication utilities
 * Re-exports safe functions for client components
 */

// Export client-safe functions
export { 
  isAdminUser, 
  hasAdminCapabilities, 
  getUserRole, 
  canAccessAdminFeatures 
} from './auth-client'

// Note: Server-only functions like requireAdminUser are in auth-server.ts
// Import from auth-server.ts in API routes only