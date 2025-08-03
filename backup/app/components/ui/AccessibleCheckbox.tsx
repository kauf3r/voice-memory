'use client'

import React from 'react'
import { generateAccessibleFieldId, ariaLabels, touchTargetClasses } from '@/lib/utils/accessibility'

interface AccessibleCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  taskId?: string
  taskText?: string
  className?: string
  disabled?: boolean
}

export function AccessibleCheckbox({
  checked,
  onChange,
  label,
  taskId,
  taskText,
  className = '',
  disabled = false
}: AccessibleCheckboxProps) {
  const checkboxId = generateAccessibleFieldId('checkbox', 'task', taskId)
  const ariaLabel = taskText 
    ? ariaLabels.taskCheckbox(taskText)
    : label || 'Checkbox'
  
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ minWidth: '44px', minHeight: '44px' }}>
      <input
        type="checkbox"
        id={checkboxId}
        name={checkboxId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
        aria-label={ariaLabel}
        role="checkbox"
        aria-checked={checked}
      />
      <label
        htmlFor={checkboxId}
        className={`
          absolute inset-0 flex items-center justify-center cursor-pointer
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        <div
          className={`
            w-5 h-5 border-2 rounded transition-all flex items-center justify-center flex-shrink-0
            ${checked 
              ? 'bg-blue-600 border-blue-600' 
              : 'bg-white border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'bg-gray-100' : ''}
          `}
        >
          {checked && (
            <svg
              className="w-3 h-3 text-white mx-auto mt-0.5"
              fill="currentColor"
              viewBox="0 0 12 10"
              aria-hidden="true"
            >
              <path d="M10.293 0.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L5 5.586 10.293.293z" />
            </svg>
          )}
        </div>
      </label>
    </div>
  )
}