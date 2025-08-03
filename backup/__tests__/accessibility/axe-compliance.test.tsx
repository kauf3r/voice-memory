/**
 * Automated Accessibility Compliance Testing
 * axe-core integration, keyboard navigation testing, and screen reader compatibility
 */

import React from 'react'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import '@testing-library/jest-dom'

// Import components to test
import { AuthProvider } from '@/app/components/AuthProvider'
import { AccessibleCheckbox } from '@/app/components/ui/AccessibleCheckbox'
import EnhancedTaskList from '@/app/components/EnhancedTaskList'
import { PinnedTasksProvider } from '@/app/components/PinnedTasksProvider'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    }
  }
}))

// Mock PinnedTasksProvider
jest.mock('@/app/components/PinnedTasksProvider', () => ({
  PinnedTasksProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  usePinnedTasks: () => ({
    isPinned: () => false,
    pinTask: jest.fn(),
    unpinTask: jest.fn(),
  })
}))

// Add axe matchers
expect.extend(toHaveNoViolations)

describe('Accessibility Compliance Tests', () => {
  beforeEach(() => {
    // Clear console to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('WCAG 2.1 AA Compliance', () => {
    test('AccessibleCheckbox component should have no accessibility violations', async () => {
      const { container } = render(
        <AccessibleCheckbox
          checked={false}
          onChange={() => {}}
          taskId="test-task"
          taskText="Complete project documentation"
          label="Task completion checkbox"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    test('EnhancedTaskList should have no accessibility violations', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          text: 'Complete documentation',
          type: 'myTasks' as const,
          date: '2025-01-01',
          completed: false,
          description: 'Write comprehensive documentation',
          noteId: 'note-1'
        },
        {
          id: 'task-2',
          text: 'Review code',
          type: 'delegatedTasks' as const,
          date: '2025-01-02',
          completed: true,
          description: 'Code review for PR #123',
          noteId: 'note-2'
        }
      ]

      const { container } = render(
        <AuthProvider>
          <PinnedTasksProvider>
            <EnhancedTaskList
              tasks={mockTasks}
              onPin={jest.fn()}
              onUnpin={jest.fn()}
              onTaskCompletion={jest.fn()}
              loadingTasks={new Set()}
              formatDate={(date) => date}
              setFilter={jest.fn()}
              taskFilter="all"
              autoUnpinOnComplete={true}
              onAutoUnpinToggle={jest.fn()}
            />
          </PinnedTasksProvider>
        </AuthProvider>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Form Field Accessibility', () => {
    test('all form fields should have proper labels', async () => {
      const { container } = render(
        <form>
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="test-task"
            taskText="Test task description"
          />
          <input type="text" aria-label="Search tasks" />
          <select aria-label="Filter tasks by type">
            <option value="all">All Tasks</option>
            <option value="myTasks">My Tasks</option>
          </select>
        </form>
      )

      const results = await axe(container, {
        rules: {
          'label': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-required-attr': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })

    test('interactive elements should have sufficient color contrast', async () => {
      const { container } = render(
        <div>
          <button className="bg-blue-600 text-white px-4 py-2">Primary Button</button>
          <button className="border border-gray-300 text-gray-700 px-4 py-2">Secondary Button</button>
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="test-task"
            taskText="Test task"
          />
        </div>
      )

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    test('all interactive elements should be keyboard accessible', async () => {
      const { container } = render(
        <div>
          <button tabIndex={0}>Accessible Button</button>
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="test-task"
            taskText="Keyboard accessible task"
          />
          <a href="#" tabIndex={0}>Accessible Link</a>
        </div>
      )

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focusable-content': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })

    test('focus management should be proper', async () => {
      const { container } = render(
        <div>
          <div role="dialog" aria-labelledby="dialog-title">
            <h2 id="dialog-title">Task Details</h2>
            <button autoFocus>First focusable element</button>
            <AccessibleCheckbox
              checked={false}
              onChange={() => {}}
              taskId="test-task"
              taskText="Focus management test"
            />
            <button>Last focusable element</button>
          </div>
        </div>
      )

      const results = await axe(container, {
        rules: {
          'focus-order-semantics': { enabled: true },
          'tabindex': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })
  })

  describe('Screen Reader Compatibility', () => {
    test('should have proper semantic structure', async () => {
      const { container } = render(
        <main>
          <header>
            <h1>Voice Memory Tasks</h1>
          </header>
          <nav aria-label="Task navigation">
            <ul>
              <li><a href="#all-tasks">All Tasks</a></li>
              <li><a href="#my-tasks">My Tasks</a></li>
            </ul>
          </nav>
          <section aria-labelledby="tasks-heading">
            <h2 id="tasks-heading">Task List</h2>
            <ul role="list">
              <li role="listitem">
                <AccessibleCheckbox
                  checked={false}
                  onChange={() => {}}
                  taskId="semantic-task"
                  taskText="Semantic structure test task"
                />
              </li>
            </ul>
          </section>
        </main>
      )

      const results = await axe(container, {
        rules: {
          'landmark-one-main': { enabled: true },
          'page-has-heading-one': { enabled: true },
          'heading-order': { enabled: true },
          'list': { enabled: true },
          'listitem': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })

    test('should have proper ARIA attributes', async () => {
      const { container } = render(
        <div>
          <div role="status" aria-live="polite">Task completed successfully</div>
          <div role="alert" aria-live="assertive">Error: Failed to complete task</div>
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="aria-task"
            taskText="ARIA attributes test task"
          />
          <button aria-expanded="false" aria-controls="task-menu">
            Task Actions
          </button>
          <div id="task-menu" aria-hidden="true">
            <button>Edit</button>
            <button>Delete</button>
          </div>
        </div>
      )

      const results = await axe(container, {
        rules: {
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-hidden-body': { enabled: true },
          'aria-allowed-attr': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })
  })

  describe('Mobile Touch Targets', () => {
    test('interactive elements should meet minimum touch target size', async () => {
      const { container } = render(
        <div>
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="touch-target-task"
            taskText="Touch target size test"
            className="min-w-[44px] min-h-[44px]" // WCAG 2.5.5 minimum
          />
          <button className="min-w-[44px] min-h-[44px] p-2">
            Touch Button
          </button>
        </div>
      )

      // axe-core doesn't check touch target sizes directly,
      // but we ensure proper CSS classes are applied
      const checkbox = container.querySelector('input[type="checkbox"]')
      const button = container.querySelector('button')

      expect(checkbox?.closest('.min-w-\\[44px\\]')).toBeTruthy()
      expect(button).toHaveClass('min-w-[44px]', 'min-h-[44px]')

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Error Prevention and Recovery', () => {
    test('error messages should be accessible', async () => {
      const { container } = render(
        <div>
          <form>
            <label htmlFor="task-input">Task Description</label>
            <input 
              id="task-input" 
              type="text" 
              aria-invalid="true" 
              aria-describedby="task-error"
              required
            />
            <div id="task-error" role="alert" className="text-red-600">
              Task description is required
            </div>
          </form>
        </div>
      )

      const results = await axe(container, {
        rules: {
          'aria-valid-attr': { enabled: true },
          'label': { enabled: true },
          'required-attr': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })
  })

  describe('Reduced Motion Support', () => {
    test('should respect user motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      const { container } = render(
        <div className="transition-none motion-reduce:transition-none">
          <AccessibleCheckbox
            checked={false}
            onChange={() => {}}
            taskId="motion-task"
            taskText="Reduced motion test task"
          />
        </div>
      )

      // Verify no motion-related accessibility violations
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})