/**
 * Centralized accessibility utilities for form fields
 * Ensures consistent, accessible ID generation and ARIA labeling
 */

/**
 * Generates a unique, accessible field ID
 * @param component - Component name (e.g., 'TaskCard', 'TaskList')
 * @param purpose - Field purpose (e.g., 'checkbox', 'select', 'bulk')
 * @param taskId - Optional task ID for task-specific fields
 * @returns Unique field ID string
 */
export function generateAccessibleFieldId(
  component: string,
  purpose: string,
  taskId?: string
): string {
  const base = `${component.toLowerCase()}-${purpose.toLowerCase()}`
  if (taskId) {
    // Use task ID for uniqueness instead of Math.random()
    return `${base}-${taskId.replace(/[^a-zA-Z0-9-]/g, '-')}`
  }
  // For non-task fields, use timestamp + counter
  return `${base}-${Date.now()}-${getUniqueCounter()}`
}

// Counter for ensuring uniqueness within same millisecond
let uniqueCounter = 0
function getUniqueCounter(): number {
  return uniqueCounter++
}

/**
 * Generates consistent ARIA labels for common form patterns
 */
export const ariaLabels = {
  taskCheckbox: (taskText: string) => `Mark "${taskText}" as complete`,
  taskPin: (taskText: string) => `Pin "${taskText}" to top`,
  taskUnpin: (taskText: string) => `Unpin "${taskText}"`,
  bulkSelect: 'Select all tasks',
  filterSelect: 'Filter tasks by type',
  searchInput: 'Search tasks',
  exportButton: 'Export tasks',
  refreshButton: 'Refresh task list'
}

/**
 * Ensures form fields have proper accessibility attributes
 * @param fieldType - Type of form field
 * @param props - Existing props
 * @returns Props with accessibility attributes added
 */
export function ensureAccessibility(
  fieldType: 'checkbox' | 'select' | 'input' | 'button',
  props: Record<string, any>
): Record<string, any> {
  const result = { ...props }
  
  // Ensure ID exists
  if (!result.id) {
    result.id = generateAccessibleFieldId('form', fieldType)
  }
  
  // Ensure name for form fields
  if (['checkbox', 'select', 'input'].includes(fieldType) && !result.name) {
    result.name = result.id
  }
  
  // Add role if needed
  if (fieldType === 'checkbox' && !result.role) {
    result.role = 'checkbox'
  }
  
  // Ensure aria-label or aria-labelledby
  if (!result['aria-label'] && !result['aria-labelledby']) {
    console.warn(`Accessibility warning: ${fieldType} field missing ARIA label`, result.id)
  }
  
  return result
}

/**
 * Touch target size compliance (WCAG 2.5.5)
 * Returns CSS classes for minimum 44x44px touch targets
 */
export const touchTargetClasses = {
  checkbox: 'min-w-[44px] min-h-[44px] p-2.5',
  button: 'min-h-[44px] px-4 py-2',
  iconButton: 'w-11 h-11 flex items-center justify-center'
}