#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function checkPartialMigration() {
  console.log('🔍 Checking partial migration status...')
  
  const supabase = createServiceClient()
  
  try {
    // Test each column individually
    const columns = [
      'error_message',
      'processing_attempts', 
      'last_error_at'
    ]
    
    const results: { [key: string]: boolean } = {}
    
    for (const column of columns) {
      try {
        const { error } = await supabase
          .from('notes')
          .update({ [column]: 'test' })
          .eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
        
        if (error && error.message.includes('column') && error.message.includes('does not exist')) {
          results[column] = false
        } else {
          results[column] = true
        }
      } catch (error) {
        results[column] = true // Column exists
      }
    }
    
    console.log('📋 Column Status:')
    Object.entries(results).forEach(([column, exists]) => {
      console.log(`  ${exists ? '✅' : '❌'} ${column}: ${exists ? 'EXISTS' : 'MISSING'}`)
    })
    
    // Test tables
    const tables = [
      'processing_errors',
      'rate_limits'
    ]
    
    console.log('\n📊 Table Status:')
    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        if (error) {
          console.log(`  ❌ ${table}: MISSING`)
        } else {
          console.log(`  ✅ ${table}: EXISTS`)
        }
      } catch (error) {
        console.log(`  ❌ ${table}: MISSING`)
      }
    }
    
    // Test functions
    const functions = [
      'log_processing_error',
      'clear_processing_error', 
      'get_processing_stats'
    ]
    
    console.log('\n🔧 Function Status:')
    for (const func of functions) {
      try {
        const { error } = await supabase.rpc(func, { 
          p_note_id: '00000000-0000-0000-0000-000000000000',
          p_error_message: 'test'
        })
        
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`  ❌ ${func}: MISSING`)
        } else {
          console.log(`  ✅ ${func}: EXISTS`)
        }
      } catch (error) {
        console.log(`  ❌ ${func}: MISSING`)
      }
    }
    
    return results
    
  } catch (error) {
    console.error('❌ Error checking partial migration:', error)
    return {}
  }
}

async function main() {
  console.log('🔧 Partial Migration Checker')
  console.log('===========================\n')
  
  await checkPartialMigration()
  
  console.log('\n💡 Next Steps:')
  console.log('If some items are missing, you can run individual SQL statements to add them.')
  console.log('The migration script will skip items that already exist.')
}

if (require.main === module) {
  main().catch(console.error)
}

export { checkPartialMigration } 