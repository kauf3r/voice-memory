/**
 * Centralized admin configuration
 * Single source of truth for admin user management
 */

// Admin emails are loaded from environment variable ADMIN_EMAILS
// Format: comma-separated list of emails, e.g., "admin@example.com,owner@example.com"
const ADMIN_EMAILS_ENV = process.env.ADMIN_EMAILS ?? ''

/**
 * Parse admin emails from environment variable
 * Returns normalized (lowercase, trimmed) list of admin emails
 */
export function getAdminEmails(): string[] {
  if (!ADMIN_EMAILS_ENV) {
    return []
  }

  return ADMIN_EMAILS_ENV
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0 && email.includes('@'))
}

/**
 * Check if an email is in the admin list
 * @param email - Email to check (case-insensitive)
 * @returns true if the email is in the admin list
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false

  const adminEmails = getAdminEmails()
  return adminEmails.includes(email.toLowerCase())
}

/**
 * Admin user IDs (for specific user overrides when email isn't available)
 * These should be Supabase user IDs
 */
export function getAdminUserIds(): string[] {
  const adminUserIds = process.env.ADMIN_USER_IDS ?? ''
  if (!adminUserIds) return []

  return adminUserIds
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
}
