export function isAdminUser(user: any): boolean {
  return user?.email?.endsWith('@voicememory.test') || 
         user?.id === 'admin-user-id' // Add specific admin user IDs here
}