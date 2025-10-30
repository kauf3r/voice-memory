'use client'

import { useState } from 'react'

interface ExportButtonProps {
  onExport: (format: 'json' | 'csv' | 'pdf') => Promise<void>
  className?: string
}

export default function ExportButton({ onExport, className = '' }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const exportFormats = [
    {
      id: 'json' as const,
      name: 'JSON',
      description: 'Complete data for developers',
      icon: '📄'
    },
    {
      id: 'csv' as const,
      name: 'CSV',
      description: 'Spreadsheet-friendly format',
      icon: '📊'
    },
    {
      id: 'pdf' as const,
      name: 'PDF',
      description: 'Formatted summary report',
      icon: '📋'
    }
  ]

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    setIsExporting(format)
    setIsOpen(false)
    
    try {
      await onExport(format)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting !== null}
        className={`
          inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
          ${isExporting 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            Exporting {isExporting.toUpperCase()}...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Export Format
              </div>
              {exportFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                >
                  <span className="text-lg">{format.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{format.name}</div>
                    <div className="text-sm text-gray-500">{format.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}