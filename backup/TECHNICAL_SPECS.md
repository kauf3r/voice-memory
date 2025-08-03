# Voice Memory Technical Specifications

## 🔧 **TECHNICAL IMPLEMENTATION SPECIFICATIONS**

### **Document Date:** August 2, 2025
### **Version:** 1.0
### **Purpose:** Detailed technical specifications for resolving authentication and accessibility issues

---

## 🔐 **AUTHENTICATION SYSTEM SPECIFICATIONS**

### **Current Architecture Problem**
```typescript
// PROBLEM: Two competing authentication systems
// System 1: /app/components/AuthProvider.tsx (Primary)
// System 2: /lib/hooks/use-auth.ts (Secondary)
// Result: Race conditions in TaskSlideoutPanel.tsx line 127
```

### **Solution: Unified Authentication Architecture**

#### **1. Remove Duplicate Authentication Hook**
```typescript
// DELETE FILE: /lib/hooks/use-auth.ts
// REASON: Causes race conditions with AuthProvider
```

#### **2. Standardize on AuthProvider.tsx**
```typescript
// REQUIRED UPDATES:
// ✅ Already fixed: /lib/contexts/ProcessingStatsContext.tsx
// 🔄 Update any remaining imports to use:
import { useAuth } from '@/app/components/AuthProvider'
```

#### **3. Simplified TaskSlideoutPanel Authentication**
```typescript
// CURRENT: 100+ lines of complex auth logic (lines 76-255)
// REPLACE WITH: Simplified pattern

const handleTaskCompletion = async (task: VoiceMemoryTask, completed: boolean) => {
  const { user, getAccessToken } = useAuth()
  
  if (!user) {
    throw new Error('Please sign in to complete tasks')
  }

  try {
    const token = await getAccessToken()
    // Single API call with proper error handling
    const response = await fetch(`/api/tasks/${task.id}/complete`, {
      method: completed ? 'POST' : 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to update task')
    }
    
    // Update local state
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, completed } : t
    ))
    
  } catch (error) {
    console.error('Task completion error:', error)
    throw error
  }
}
```

#### **4. Session Caching Implementation**
```typescript
// ADD TO AuthProvider.tsx
const sessionCache = new Map<string, { session: Session, timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const getCachedSession = async (): Promise<Session | null> => {
  const cached = sessionCache.get('current')
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.session
  }
  
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    sessionCache.set('current', { session, timestamp: Date.now() })
  }
  
  return session
}
```

---

## 🗄️ **DATABASE SCHEMA SPECIFICATIONS**

### **Current Schema Problem**
```sql
-- PROBLEM: Three overlapping tables
-- task_pins (working)
-- task_completions (working) 
-- task_states (recently created, not integrated)
-- RESULT: Data fragmentation and sync issues
```

### **Solution: Unified task_states Table**

#### **1. Migration Strategy**
```sql
-- STEP 1: Migrate existing data to task_states
INSERT INTO task_states (user_id, task_id, note_id, pinned, pinned_at, pin_order)
SELECT user_id, task_id, note_id, true, pinned_at, pin_order 
FROM task_pins;

INSERT INTO task_states (user_id, task_id, note_id, completed, completed_at, completed_by)
SELECT user_id, task_id, note_id, true, completed_at, completed_by 
FROM task_completions
ON CONFLICT (user_id, task_id) 
DO UPDATE SET 
  completed = EXCLUDED.completed,
  completed_at = EXCLUDED.completed_at,
  completed_by = EXCLUDED.completed_by;

-- STEP 2: Update API endpoints to use task_states
-- STEP 3: Remove deprecated tables after validation
-- DROP TABLE task_pins;
-- DROP TABLE task_completions;
```

#### **2. Updated API Endpoint Pattern**
```typescript
// /api/tasks/[id]/complete/route.ts
// REPLACE task_completions with task_states

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: taskId } = await params
  const { user, client } = await getAuthenticatedUser(token)
  
  // USE UPSERT pattern for task_states
  const { data, error } = await client
    .from('task_states')
    .upsert({
      user_id: user.id,
      task_id: taskId,
      note_id: extractNoteId(taskId),
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user.email || user.id
    })
    .select()
    .single()
    
  return NextResponse.json({ success: true, data })
}
```

#### **3. RLS Policy Enhancement**
```sql
-- REPLACE SERVICE_KEY usage with user-scoped authentication
-- ENHANCED RLS policies for task_states

CREATE POLICY "Enhanced task state access" ON task_states 
FOR ALL USING (
  auth.uid() = user_id AND 
  validate_user_task_access(user_id, task_id)
);

-- Add validation function
CREATE OR REPLACE FUNCTION validate_user_task_access(
  p_user_id UUID, 
  p_task_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM voice_notes 
    WHERE user_id = p_user_id 
    AND id = (split_part(p_task_id, '-', 1))::UUID
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ♿ **ACCESSIBILITY SPECIFICATIONS**

### **Current Problem: 102 Form Field Violations**
```typescript
// PROBLEM: Inconsistent ID generation across components
// Pattern found in 6 components:
id={`prefix-${task.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`}
```

### **Solution: Centralized Accessibility Utility**

#### **1. Form Utility System**
```typescript
// CREATE: /lib/utils/accessibility.ts

interface AccessibleFieldProps {
  component: string
  purpose: 'selection' | 'completion' | 'pin' | 'filter'
  identifier: string
  label: string
  description?: string
}

export const generateAccessibleField = ({
  component,
  purpose,
  identifier,
  label,
  description
}: AccessibleFieldProps) => {
  const id = `${component}-${purpose}-${identifier}`
  const descriptionId = description ? `${id}-description` : undefined
  
  return {
    id,
    name: `${component}-${purpose}`,
    'aria-label': label,
    'aria-describedby': descriptionId,
    descriptionId
  }
}

// Usage example:
const { id, name, 'aria-label': ariaLabel } = generateAccessibleField({
  component: 'task-card',
  purpose: 'completion',
  identifier: task.id,
  label: `Mark as ${completed ? 'incomplete' : 'complete'}: ${task.description}`
})
```

#### **2. Accessible Form Components**
```typescript
// CREATE: /components/ui/AccessibleCheckbox.tsx

interface AccessibleCheckboxProps {
  id: string
  name: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const AccessibleCheckbox = ({
  id,
  name,
  label,
  description,
  checked,
  onChange,
  disabled
}: AccessibleCheckboxProps) => {
  const descriptionId = description ? `${id}-description` : undefined
  
  return (
    <div className="accessible-checkbox-wrapper">
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={label}
        aria-describedby={descriptionId}
        className="accessible-checkbox"
      />
      <label htmlFor={id} className="checkbox-label">
        <span className="sr-only">{label}</span>
      </label>
      {description && (
        <div id={descriptionId} className="checkbox-description">
          {description}
        </div>
      )}
    </div>
  )
}
```

#### **3. Component Updates Required**

**EnhancedTaskList.tsx (line 191):**
```typescript
// REPLACE:
<input
  type="checkbox"
  id={`enhanced-complete-${task.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`}
  // ... other props
/>

// WITH:
const checkboxProps = generateAccessibleField({
  component: 'enhanced-task-list',
  purpose: 'completion',
  identifier: task.id,
  label: `Mark as ${task.completed ? 'incomplete' : 'complete'}: ${task.text}`
})

<AccessibleCheckbox
  {...checkboxProps}
  checked={task.completed}
  onChange={(checked) => onTaskCompletion(task, checked)}
  disabled={loadingTasks.has(task.id)}
/>
```

**SelectableTaskCard.tsx (lines 58, 149):**
```typescript
// REPLACE both checkbox instances with AccessibleCheckbox
// Selection checkbox:
const selectionProps = generateAccessibleField({
  component: 'selectable-task-card',
  purpose: 'selection',
  identifier: task.id,
  label: `Select task: ${task.text}`
})

// Completion checkbox:
const completionProps = generateAccessibleField({
  component: 'selectable-task-card',
  purpose: 'completion',
  identifier: task.id,
  label: `Mark as ${task.completed ? 'incomplete' : 'complete'}: ${task.text}`
})
```

**DraggablePinnedTask.tsx (line 148):**
```typescript
// REPLACE with AccessibleCheckbox
const pinCheckboxProps = generateAccessibleField({
  component: 'draggable-pinned-task',
  purpose: 'completion',
  identifier: task.id,
  label: `Mark as ${task.completed ? 'incomplete' : 'complete'}: ${task.text}`
})
```

---

## ⚡ **PERFORMANCE SPECIFICATIONS**

### **React Performance Optimizations**

#### **1. Component Memoization**
```typescript
// TaskSlideoutPanel.tsx
export default React.memo(TaskSlideoutPanel, (prevProps, nextProps) => {
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.highlightTaskId === nextProps.highlightTaskId &&
    JSON.stringify(prevProps.initialTasks) === JSON.stringify(nextProps.initialTasks)
  )
})

// EnhancedTaskList.tsx  
export default React.memo(EnhancedTaskList, (prevProps, nextProps) => {
  return (
    prevProps.tasks === nextProps.tasks &&
    prevProps.taskFilter === nextProps.taskFilter &&
    prevProps.loadingTasks === nextProps.loadingTasks
  )
})
```

#### **2. State Management Optimization**
```typescript
// Fix circular dependencies in PinnedTasksProvider
const PinnedTasksProvider = ({ children }: { children: React.ReactNode }) => {
  // REPLACE circular ref pattern with stable references
  const stableCallbacks = useMemo(() => ({
    pinTask: async (taskId: string) => {
      // Implementation
    },
    unpinTask: async (taskId: string) => {
      // Implementation  
    }
  }), []) // Empty dependency array for stable callbacks

  return (
    <PinnedTasksContext.Provider value={stableCallbacks}>
      {children}
    </PinnedTasksContext.Provider>
  )
}
```

#### **3. Subscription Management**
```typescript
// Simplified real-time subscription pattern
const useTaskSubscription = (userId: string) => {
  useEffect(() => {
    const subscription = supabase
      .channel('task_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_states',
        filter: `user_id=eq.${userId}`
      }, handleChange)
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId])
}
```

---

## 🧪 **TESTING SPECIFICATIONS**

### **Authentication Testing Framework**

#### **1. Unit Test Setup**
```typescript
// __tests__/auth/AuthProvider.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from '@/app/components/AuthProvider'

describe('AuthProvider', () => {
  it('should handle session timeout gracefully', async () => {
    // Test 15-second timeout behavior
  })
  
  it('should prevent race conditions in concurrent auth calls', async () => {
    // Test multiple simultaneous getAccessToken calls
  })
  
  it('should cache sessions properly', async () => {
    // Test session caching implementation
  })
})
```

#### **2. Integration Test Pattern**
```typescript
// __tests__/integration/task-completion.test.tsx
describe('Task Completion Flow', () => {
  it('should complete task successfully with valid auth', async () => {
    // Mock auth state
    // Trigger task completion
    // Verify API call and state update
  })
  
  it('should handle auth failure gracefully', async () => {
    // Mock auth failure
    // Verify error handling
  })
})
```

#### **3. Accessibility Testing**
```typescript
// __tests__/accessibility/form-fields.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Form Field Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<TaskComponent />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  
  it('should have proper ARIA labels', () => {
    render(<TaskCheckbox {...props} />)
    expect(screen.getByRole('checkbox')).toHaveAccessibleName()
  })
})
```

---

## 📱 **MOBILE SPECIFICATIONS**

### **Touch Target Requirements**
```css
/* Minimum touch target sizes */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
  margin: 8px;
}

/* Task checkbox styling */
.task-checkbox {
  width: 24px;
  height: 24px;
  margin: 10px; /* Creates 44px total touch target */
}

/* Mobile-specific breakpoints */
@media (max-width: 768px) {
  .task-slideout {
    width: 100vw;
    height: 100vh;
  }
  
  .task-actions {
    gap: 16px; /* Increased spacing for touch */
  }
}
```

### **Responsive Design Patterns**
```typescript
// Mobile-optimized TaskSlideoutPanel
const TaskSlideoutPanel = ({ isOpen, onClose }: Props) => {
  return (
    <div 
      className={`
        fixed inset-0 z-50
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        w-full md:w-[400px] lg:w-[500px]
        md:right-0 md:left-auto
      `}
    >
      {/* Mobile swipe indicator */}
      <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2">
        <div className="w-1 h-20 bg-gray-300 rounded-r-full" />
      </div>
      
      {/* Content */}
    </div>
  )
}
```

---

## 🔒 **SECURITY SPECIFICATIONS**

### **Authentication Security**
```typescript
// Secure token handling
const getAuthenticatedUser = async (token: string) => {
  if (!token || !token.startsWith('eyJ')) {
    throw new Error('Invalid token format')
  }
  
  // Use user-scoped client instead of SERVICE_KEY
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    }
  )
  
  const { data: { user }, error } = await client.auth.getUser()
  
  if (error || !user) {
    throw new Error('Authentication failed')
  }
  
  return { user, client }
}
```

### **Input Validation**
```typescript
// API endpoint input validation
const validateTaskId = (taskId: string): boolean => {
  // UUID-task-index format validation
  const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-task-\d+$/
  return taskIdPattern.test(taskId)
}

// Sanitize user input
const sanitizeInput = (input: string): string => {
  return input.replace(/[<>\"'&]/g, (match) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    }
    return escapeMap[match]
  })
}
```

---

## 📊 **MONITORING SPECIFICATIONS**

### **Performance Metrics**
```typescript
// Performance monitoring setup
const performanceMetrics = {
  authFlowDuration: 2000, // 2 seconds max
  taskCompletionTime: 500, // 500ms max
  pageLoadTime: 3000, // 3 seconds max
  memoryUsageThreshold: 50 * 1024 * 1024 // 50MB max
}

// Automated performance alerts
const monitorPerformance = () => {
  if (performance.now() > performanceMetrics.authFlowDuration) {
    console.warn('Authentication flow exceeded target duration')
  }
}
```

### **Error Tracking**
```typescript
// Structured error logging
const logError = (error: Error, context: Record<string, any>) => {
  const sanitizedContext = {
    ...context,
    // Remove sensitive information
    user: context.user ? { id: context.user.id } : null,
    token: '[REDACTED]'
  }
  
  console.error('Application error:', {
    message: error.message,
    stack: error.stack,
    context: sanitizedContext,
    timestamp: new Date().toISOString()
  })
}
```

---

## ✅ **VALIDATION CHECKLIST**

### **Pre-Implementation Validation**
- [ ] Backup current authentication implementation
- [ ] Document current API endpoints and usage
- [ ] Set up testing environment
- [ ] Prepare rollback procedures

### **Authentication Validation**
- [ ] Remove `/lib/hooks/use-auth.ts` completely
- [ ] Update all component imports to use AuthProvider
- [ ] Simplify TaskSlideoutPanel authentication flow
- [ ] Test session caching implementation
- [ ] Validate single authentication source

### **Database Validation**
- [ ] Migrate data to task_states table
- [ ] Update API endpoints to use unified table
- [ ] Test RLS policy enforcement
- [ ] Validate task completion flow
- [ ] Remove deprecated tables

### **Accessibility Validation**
- [ ] Create accessibility utility functions
- [ ] Update all form field components
- [ ] Test with screen readers
- [ ] Validate WCAG 2.1 AA compliance
- [ ] Run automated accessibility tests

### **Performance Validation**
- [ ] Add React.memo to components
- [ ] Fix circular dependencies
- [ ] Implement subscription optimization
- [ ] Measure performance improvements
- [ ] Validate mobile responsiveness

### **Testing Validation**
- [ ] Set up authentication unit tests
- [ ] Create task completion integration tests
- [ ] Implement accessibility testing
- [ ] Add performance benchmarking
- [ ] Validate cross-browser compatibility

---

**This technical specification provides detailed implementation guidance for resolving all identified issues in the Voice Memory application.**

**Generated by Expert Team Analysis - August 2, 2025**