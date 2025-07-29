#!/usr/bin/env tsx

/**
 * Cleanup script to identify and help remove diagnostic scripts that are now redundant
 * due to improved error tracking and processing pipeline consolidation.
 */

import fs from 'fs'
import path from 'path'

interface ScriptInfo {
  name: string
  path: string
  purpose: string
  redundant: boolean
  replacement: string
  keepReason?: string
}

const scriptsDir = path.join(process.cwd(), 'scripts')

const scriptAnalysis: ScriptInfo[] = [
  {
    name: 'diagnose-stuck-notes.ts',
    path: 'scripts/diagnose-stuck-notes.ts',
    purpose: 'Diagnose notes stuck in processing',
    redundant: true,
    replacement: 'Database error tracking and ProcessingStatus component'
  },
  {
    name: 'fix-stuck-notes.ts',
    path: 'scripts/fix-stuck-notes.ts',
    purpose: 'Fix notes stuck in processing',
    redundant: true,
    replacement: 'Automated retry functionality and error persistence'
  },
  {
    name: 'reset-stuck-processing.ts',
    path: 'scripts/reset-stuck-processing.ts',
    purpose: 'Reset stuck processing state',
    redundant: true,
    replacement: 'processingService.resetStuckProcessing() method'
  },
  {
    name: 'force-process-note.ts',
    path: 'scripts/force-process-note.ts',
    purpose: 'Force process a single note',
    redundant: true,
    replacement: 'processingService.processNote(noteId, userId, true)'
  },
  {
    name: 'manual-process.ts',
    path: 'scripts/manual-process.ts',
    purpose: 'Manual processing trigger',
    redundant: true,
    replacement: 'API endpoints and automated cron jobs'
  },
  {
    name: 'trigger-processing.ts',
    path: 'scripts/trigger-processing.ts',
    purpose: 'Trigger batch processing',
    redundant: true,
    replacement: 'processingService.processNextBatch() and cron jobs'
  },
  {
    name: 'trigger-batch-processing.ts',
    path: 'scripts/trigger-batch-processing.ts',
    purpose: 'Trigger batch processing',
    redundant: true,
    replacement: 'processingService.processNextBatch() and cron jobs'
  },
  {
    name: 'setup-processing-queue.ts',
    path: 'scripts/setup-processing-queue.ts',
    purpose: 'Setup processing queue',
    redundant: true,
    replacement: 'Consolidated processing service'
  },
  {
    name: 'check-processing-status.ts',
    path: 'scripts/check-processing-status.ts',
    purpose: 'Check processing status',
    redundant: true,
    replacement: 'ProcessingStatus component and real-time updates'
  },
  {
    name: 'quick-stuck-check.ts',
    path: 'scripts/quick-stuck-check.ts',
    purpose: 'Quick check for stuck notes',
    redundant: true,
    replacement: 'Database queries with error tracking'
  },
  {
    name: 'reset-note.ts',
    path: 'scripts/reset-note.ts',
    purpose: 'Reset individual note',
    redundant: true,
    replacement: 'processingService.processNote() with forceReprocess'
  },
  {
    name: 'force-reset-single.ts',
    path: 'scripts/force-reset-single.ts',
    purpose: 'Force reset single note',
    redundant: true,
    replacement: 'processingService.processNote() with forceReprocess'
  },
  {
    name: 'test-single-note.ts',
    path: 'scripts/test-single-note.ts',
    purpose: 'Test single note processing',
    redundant: true,
    replacement: 'Integration tests and processing service'
  },
  {
    name: 'test-analysis.ts',
    path: 'scripts/test-analysis.ts',
    purpose: 'Test analysis functionality',
    redundant: true,
    replacement: 'Integration tests and OpenAI service'
  },
  {
    name: 'debug-analysis.ts',
    path: 'scripts/debug-analysis.ts',
    purpose: 'Debug analysis issues',
    redundant: true,
    replacement: 'Error tracking and detailed error messages'
  },
  {
    name: 'inspect-analysis.ts',
    path: 'scripts/inspect-analysis.ts',
    purpose: 'Inspect analysis results',
    redundant: true,
    replacement: 'UI components and error display'
  },
  {
    name: 'view-analysis.ts',
    path: 'scripts/view-analysis.ts',
    purpose: 'View analysis results',
    redundant: true,
    replacement: 'UI components and note cards'
  },
  {
    name: 'debug-gpt-response.ts',
    path: 'scripts/debug-gpt-response.ts',
    purpose: 'Debug GPT responses',
    redundant: true,
    replacement: 'Enhanced error handling and retry logic'
  },
  {
    name: 'debug-validation.ts',
    path: 'scripts/debug-validation.ts',
    purpose: 'Debug validation issues',
    redundant: true,
    replacement: 'Improved validation and error reporting'
  },
  {
    name: 'test-ui-e2e.ts',
    path: 'scripts/test-ui-e2e.ts',
    purpose: 'End-to-end UI testing',
    redundant: false,
    keepReason: 'E2E testing is still valuable for UI validation',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'test-openai.ts',
    path: 'scripts/test-openai.ts',
    purpose: 'Test OpenAI integration',
    redundant: false,
    keepReason: 'Useful for testing OpenAI API connectivity',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'test-openai-connection.ts',
    path: 'scripts/test-openai-connection.ts',
    purpose: 'Test OpenAI connection',
    redundant: false,
    keepReason: 'Useful for testing OpenAI API connectivity',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'test-supabase.ts',
    path: 'scripts/test-supabase.ts',
    purpose: 'Test Supabase connection',
    redundant: false,
    keepReason: 'Useful for testing database connectivity',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'check-database-schema.ts',
    path: 'scripts/check-database-schema.ts',
    purpose: 'Check database schema',
    redundant: false,
    keepReason: 'Useful for schema validation and migrations',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'check-db-schema.ts',
    path: 'scripts/check-db-schema.ts',
    purpose: 'Check database schema',
    redundant: false,
    keepReason: 'Useful for schema validation and migrations',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'simple-db-check.ts',
    path: 'scripts/simple-db-check.ts',
    purpose: 'Simple database check',
    redundant: false,
    keepReason: 'Useful for quick database connectivity tests',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'quick-check.ts',
    path: 'scripts/quick-check.ts',
    purpose: 'Quick system check',
    redundant: false,
    keepReason: 'Useful for system health checks',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'auto-uploader.ts',
    path: 'scripts/auto-uploader.ts',
    purpose: 'Automated file uploader',
    redundant: false,
    keepReason: 'Useful for testing and automation',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'direct-processing.ts',
    path: 'scripts/direct-processing.ts',
    purpose: 'Direct processing bypass',
    redundant: false,
    keepReason: 'Useful for debugging and testing',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'generate-auth-token.ts',
    path: 'scripts/generate-auth-token.ts',
    purpose: 'Generate authentication tokens',
    redundant: false,
    keepReason: 'Useful for testing and development',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'quick-auth-setup.ts',
    path: 'scripts/quick-auth-setup.ts',
    purpose: 'Quick authentication setup',
    redundant: false,
    keepReason: 'Useful for development and testing',
    replacement: 'N/A - keeping script'
  },
  {
    name: 'fix-auth-setup.ts',
    path: 'scripts/fix-auth-setup.ts',
    purpose: 'Fix authentication setup',
    redundant: false,
    keepReason: 'Useful for troubleshooting auth issues',
    replacement: 'N/A - keeping script'
  }
]

function checkScriptExists(scriptPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), scriptPath))
}

function generateMigrationGuide(): void {
  console.log('🔍 Voice Memory Script Cleanup Analysis')
  console.log('=====================================\n')

  const redundantScripts = scriptAnalysis.filter(s => s.redundant)
  const keepScripts = scriptAnalysis.filter(s => !s.redundant)

  console.log(`📊 Summary:`)
  console.log(`   Total scripts analyzed: ${scriptAnalysis.length}`)
  console.log(`   Redundant scripts: ${redundantScripts.length}`)
  console.log(`   Scripts to keep: ${keepScripts.length}`)
  console.log('')

  if (redundantScripts.length > 0) {
    console.log('🗑️  REDUNDANT SCRIPTS (Safe to remove):')
    console.log('=====================================')
    
    redundantScripts.forEach(script => {
      const exists = checkScriptExists(script.path)
      const status = exists ? '✅' : '❌'
      console.log(`${status} ${script.name}`)
      console.log(`   Purpose: ${script.purpose}`)
      console.log(`   Replacement: ${script.replacement}`)
      console.log('')
    })
  }

  if (keepScripts.length > 0) {
    console.log('💾 SCRIPTS TO KEEP:')
    console.log('==================')
    
    keepScripts.forEach(script => {
      const exists = checkScriptExists(script.path)
      const status = exists ? '✅' : '❌'
      console.log(`${status} ${script.name}`)
      console.log(`   Purpose: ${script.purpose}`)
      console.log(`   Keep Reason: ${script.keepReason}`)
      console.log('')
    })
  }

  console.log('🔄 MIGRATION RECOMMENDATIONS:')
  console.log('============================')
  console.log('')
  console.log('1. Remove redundant scripts:')
  redundantScripts.forEach(script => {
    if (checkScriptExists(script.path)) {
      console.log(`   rm ${script.path}`)
    }
  })
  console.log('')
  console.log('2. Update documentation:')
  console.log('   - Remove references to deleted scripts')
  console.log('   - Update troubleshooting guides')
  console.log('   - Point users to new error tracking features')
  console.log('')
  console.log('3. New error tracking features:')
  console.log('   - Error messages are now stored in database')
  console.log('   - Processing attempts are tracked')
  console.log('   - Retry functionality is built into UI')
  console.log('   - Automated cron jobs handle batch processing')
  console.log('   - Real-time status updates in ProcessingStatus component')
  console.log('')
  console.log('4. Testing improvements:')
  console.log('   - Integration tests cover processing pipeline')
  console.log('   - Error scenarios are tested')
  console.log('   - Retry functionality is verified')
  console.log('')
}

function generateCleanupScript(): void {
  const redundantScripts = scriptAnalysis.filter(s => s.redundant && checkScriptExists(s.path))
  
  if (redundantScripts.length === 0) {
    console.log('No redundant scripts found to remove.')
    return
  }

  const cleanupScript = `#!/bin/bash
# Auto-generated cleanup script for redundant diagnostic scripts
# Generated on: ${new Date().toISOString()}

echo "🧹 Cleaning up redundant diagnostic scripts..."
echo ""

${redundantScripts.map(script => `# Remove ${script.name}
echo "Removing ${script.name}..."
rm -f "${script.path}"
if [ $? -eq 0 ]; then
    echo "✅ Removed ${script.name}"
else
    echo "❌ Failed to remove ${script.name}"
fi
echo ""`).join('\n')}

echo "🎉 Cleanup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Update any documentation that references these scripts"
echo "2. Test the new error tracking features"
echo "3. Verify that processing pipeline works correctly"
echo ""
`

  const cleanupPath = path.join(process.cwd(), 'scripts', 'cleanup-redundant-scripts.sh')
  fs.writeFileSync(cleanupPath, cleanupScript)
  fs.chmodSync(cleanupPath, 0o755)
  
  console.log(`📝 Generated cleanup script: ${cleanupPath}`)
  console.log('Run it with: ./scripts/cleanup-redundant-scripts.sh')
}

// Main execution
if (require.main === module) {
  generateMigrationGuide()
  console.log('')
  generateCleanupScript()
} 