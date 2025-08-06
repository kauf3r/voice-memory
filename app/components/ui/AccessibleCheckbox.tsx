'use client'

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