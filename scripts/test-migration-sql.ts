#!/usr/bin/env tsx
import { readFileSync } from 'fs'
import { join } from 'path'

console.log('🧪 Testing SQL Migration Syntax...\n')

try {
  // Read the migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/20240120_add_processing_lock.sql')
  const migrationSQL = readFileSync(migrationPath, 'utf-8')
  
  console.log('✅ Migration file read successfully')
  console.log(`   File size: ${migrationSQL.length} characters`)
  
  // Check for common syntax patterns
  const checks = [
    { name: 'Column addition', pattern: /ADD COLUMN processing_started_at/, found: false },
    { name: 'Index creation', pattern: /CREATE INDEX.*processing_started_at/, found: false },
    { name: 'Lock function', pattern: /acquire_processing_lock/, found: false },
    { name: 'Release function', pattern: /release_processing_lock/, found: false },
    { name: 'Cleanup function', pattern: /cleanup_abandoned_processing_locks/, found: false },
    { name: 'Get notes function', pattern: /get_next_notes_for_processing/, found: false },
    { name: 'Stats function', pattern: /get_processing_stats/, found: false },
    { name: 'ROW_COUNT usage', pattern: /GET DIAGNOSTICS.*ROW_COUNT/, found: false },
    { name: 'Permission grants', pattern: /GRANT EXECUTE/, found: false }
  ]
  
  // Check each pattern
  checks.forEach(check => {
    check.found = check.pattern.test(migrationSQL)
  })
  
  console.log('\n📋 SQL Components Check:')
  checks.forEach(check => {
    const status = check.found ? '✅' : '❌'
    console.log(`   ${status} ${check.name}`)
  })
  
  // Check for problematic patterns
  const problems = [
    { name: 'Old FOUND syntax', pattern: /GET DIAGNOSTICS.*FOUND/, found: false },
    { name: 'Missing semicolons', pattern: /\n[^-].*[^;]\s*\n/, found: false }
  ]
  
  problems.forEach(problem => {
    problem.found = problem.pattern.test(migrationSQL)
  })
  
  console.log('\n⚠️  Potential Issues Check:')
  problems.forEach(problem => {
    const status = problem.found ? '❌ FOUND' : '✅ OK'
    console.log(`   ${status} ${problem.name}`)
  })
  
  // Count functions
  const functionMatches = migrationSQL.match(/CREATE OR REPLACE FUNCTION/g)
  const functionCount = functionMatches ? functionMatches.length : 0
  
  console.log(`\n📊 Summary:`)
  console.log(`   • Functions defined: ${functionCount}`)
  console.log(`   • All checks passed: ${checks.every(c => c.found) ? 'YES' : 'NO'}`)
  console.log(`   • No issues found: ${problems.every(p => !p.found) ? 'YES' : 'NO'}`)
  
  if (checks.every(c => c.found) && problems.every(p => !p.found)) {
    console.log('\n🎉 Migration SQL syntax looks correct!')
    console.log('\n📋 Ready to apply in Supabase Dashboard:')
    console.log('   1. Copy the migration file contents')
    console.log('   2. Paste into Supabase SQL Editor')
    console.log('   3. Execute the SQL')
  } else {
    console.log('\n❌ Issues found in migration SQL')
    if (!checks.every(c => c.found)) {
      console.log('   Missing required components')
    }
    if (!problems.every(p => !p.found)) {
      console.log('   Syntax problems detected')
    }
  }
  
} catch (error) {
  console.error('❌ Error testing migration:', error)
  process.exit(1)
}

process.exit(0) 