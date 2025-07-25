#!/usr/bin/env tsx

/**
 * Emergency Fix Processing Script
 * 
 * This script performs comprehensive emergency fixes for the Voice Memory processing pipeline.
 * It addresses the critical issues that have caused note processing to stop working.
 * 
 * Usage: npm run script scripts/emergency-fix-processing.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface FixResult {
  success: boolean
  message: string
  details?: any
}

interface SystemStatus {
  databaseMigration: FixResult
  stuckProcessing: FixResult
  environmentVariables: FixResult
  processingPipeline: FixResult
  cronEndpoint: FixResult
}

class EmergencyFixProcessor {
  private supabase: any
  private results: SystemStatus

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    this.results = {
      databaseMigration: { success: false, message: 'Not started' },
      stuckProcessing: { success: false, message: 'Not started' },
      environmentVariables: { success: false, message: 'Not started' },
      processingPipeline: { success: false, message: 'Not started' },
      cronEndpoint: { success: false, message: 'Not started' }
    }
  }

  async run(): Promise<void> {
    console.log('🚨 Starting Emergency Fix Processing...\n')
    
    try {
      // Step 1: Apply missing database migration
      await this.applyDatabaseMigration()
      
      // Step 2: Reset stuck processing locks
      await this.resetStuckProcessing()
      
      // Step 3: Verify environment variables
      await this.verifyEnvironmentVariables()
      
      // Step 4: Test processing pipeline
      await this.testProcessingPipeline()
      
      // Step 5: Validate cron endpoint
      await this.validateCronEndpoint()
      
      // Generate final report
      this.generateReport()
      
    } catch (error) {
      console.error('❌ Emergency fix failed:', error)
      process.exit(1)
    }
  }

  private async applyDatabaseMigration(): Promise<void> {
    console.log('📋 Step 1: Checking database migration status...')
    
    try {
      // Check if error tracking columns exist
      const { data: columns, error } = await this.supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'notes')
        .in('column_name', ['error_message', 'processing_attempts', 'last_error_at'])
      
      if (error) {
        this.results.databaseMigration = {
          success: false,
          message: `Failed to check column existence: ${error.message}`
        }
        return
      }

      const existingColumns = columns?.map(c => c.column_name) || []
      const requiredColumns = ['error_message', 'processing_attempts', 'last_error_at']
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

      // Also check if processing_errors table exists
      const { data: tableExists, error: tableError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'processing_errors')
        .eq('table_schema', 'public')

      const processingErrorsExists = tableExists && tableExists.length > 0

      if (missingColumns.length === 0 && processingErrorsExists) {
        this.results.databaseMigration = {
          success: true,
          message: 'Database migration already applied',
          details: { existingColumns, processingErrorsExists }
        }
        console.log('✅ Database migration: Already applied')
        return
      }

      console.log(`⚠️  Migration needed: ${missingColumns.length > 0 ? `missing columns [${missingColumns.join(', ')}]` : ''} ${!processingErrorsExists ? 'missing processing_errors table' : ''}`)
      console.log('🔧 Applying database migration with enhanced executor...')

      // Read and execute the migration file using enhanced executor
      const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql')
      
      if (!fs.existsSync(migrationPath)) {
        this.results.databaseMigration = {
          success: false,
          message: 'Migration file not found: 20240119_add_error_tracking.sql'
        }
        return
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      const migrationResult = await this.executeMigrationFile(migrationSQL)
      
      if (!migrationResult.success) {
        this.results.databaseMigration = {
          success: false,
          message: `Migration execution failed: ${migrationResult.error}`,
          details: migrationResult.details
        }
        console.log(`❌ Database migration: ${migrationResult.error}`)
        return
      }

      // Verify the migration was successful
      const verificationResult = await this.verifyMigrationSuccess()
      this.results.databaseMigration = verificationResult
      
      if (verificationResult.success) {
        console.log('✅ Database migration: Applied successfully with enhanced executor')
      } else {
        console.log(`❌ Database migration: ${verificationResult.message}`)
      }

    } catch (error) {
      this.results.databaseMigration = {
        success: false,
        message: `Migration failed: ${error.message}`
      }
      console.log(`❌ Database migration: ${error.message}`)
    }
  }

  private async executeMigrationFile(migrationSQL: string): Promise<{success: boolean, error?: string, details?: any}> {
    console.log('🔧 Parsing migration SQL into individual statements...')
    
    try {
      const statements = this.parseSQLStatements(migrationSQL)
      console.log(`📝 Found ${statements.length} SQL statements to execute`)
      
      const executionResults = []
      let successCount = 0
      let errorCount = 0
      
      // Execute statements in sequence (not in transaction to handle RLS and function creation)
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        const statementType = this.getStatementType(statement)
        
        console.log(`  ${i + 1}/${statements.length}: Executing ${statementType}...`)
        
        try {
          // Use different execution strategies based on statement type
          let result
          if (statementType === 'CREATE_FUNCTION' || statementType === 'CREATE_POLICY') {
            // These require service role and special handling
            result = await this.executeWithServiceRole(statement)
          } else {
            // Standard DDL statements
            result = await this.supabase.rpc('exec_sql', { sql: statement })
          }
          
          if (result.error) {
            // Check if error is ignorable (like "already exists")
            if (this.isIgnorableError(result.error.message)) {
              console.log(`    ⚠️  Ignorable: ${result.error.message}`)
              executionResults.push({ statement: statementType, status: 'skipped', message: result.error.message })
            } else {
              console.log(`    ❌ Failed: ${result.error.message}`)
              executionResults.push({ statement: statementType, status: 'failed', error: result.error.message })
              errorCount++
            }
          } else {
            console.log(`    ✅ Success`)
            executionResults.push({ statement: statementType, status: 'success' })
            successCount++
          }
        } catch (execError) {
          console.log(`    ❌ Exception: ${execError.message}`)
          executionResults.push({ statement: statementType, status: 'exception', error: execError.message })
          errorCount++
        }
      }
      
      console.log(`📊 Migration execution completed: ${successCount} successful, ${errorCount} failed`)
      
      return {
        success: errorCount === 0 || (successCount > 0 && errorCount < statements.length / 2), // Success if no errors or mostly successful
        details: {
          totalStatements: statements.length,
          successCount,
          errorCount,
          executionResults
        }
      }
      
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse migration SQL: ${parseError.message}`,
        details: { parseError: parseError.message }
      }
    }
  }
  
  private parseSQLStatements(sql: string): string[] {
    // Remove comments and normalize whitespace
    const cleanSQL = sql
      .replace(/--[^\n\r]*[\n\r]/g, '\n') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    const statements = []
    let currentStatement = ''
    let inFunction = false
    let functionDelimiter = ''
    let parenDepth = 0
    let i = 0
    
    while (i < cleanSQL.length) {
      const char = cleanSQL[i]
      const remaining = cleanSQL.slice(i)
      
      // Handle function definitions with $$ delimiters
      if (!inFunction && remaining.match(/^\$\$|^\$[a-zA-Z_][a-zA-Z0-9_]*\$/)) {
        const delimiterMatch = remaining.match(/^(\$[a-zA-Z0-9_]*\$)/)
        if (delimiterMatch) {
          functionDelimiter = delimiterMatch[1]
          inFunction = true
          currentStatement += delimiterMatch[1]
          i += delimiterMatch[1].length
          continue
        }
      }
      
      if (inFunction && remaining.startsWith(functionDelimiter)) {
        inFunction = false
        currentStatement += functionDelimiter
        i += functionDelimiter.length
        functionDelimiter = ''
        continue
      }
      
      // Track parentheses depth
      if (char === '(') parenDepth++
      if (char === ')') parenDepth--
      
      currentStatement += char
      
      // Statement delimiter (semicolon not in function and at paren depth 0)
      if (char === ';' && !inFunction && parenDepth === 0) {
        const trimmed = currentStatement.trim()
        if (trimmed && trimmed !== ';') {
          statements.push(trimmed)
        }
        currentStatement = ''
      }
      
      i++
    }
    
    // Add final statement if exists
    const finalStatement = currentStatement.trim()
    if (finalStatement && finalStatement !== ';') {
      statements.push(finalStatement)
    }
    
    return statements.filter(stmt => stmt.length > 0)
  }
  
  private getStatementType(statement: string): string {
    const normalized = statement.trim().toUpperCase()
    
    if (normalized.startsWith('ALTER TABLE')) return 'ALTER_TABLE'
    if (normalized.startsWith('CREATE TABLE')) return 'CREATE_TABLE'
    if (normalized.startsWith('CREATE INDEX')) return 'CREATE_INDEX'
    if (normalized.startsWith('CREATE OR REPLACE FUNCTION')) return 'CREATE_FUNCTION'
    if (normalized.startsWith('CREATE POLICY')) return 'CREATE_POLICY'
    if (normalized.startsWith('ALTER TABLE') && normalized.includes('ENABLE ROW LEVEL SECURITY')) return 'ENABLE_RLS'
    if (normalized.startsWith('GRANT')) return 'GRANT'
    
    return 'UNKNOWN'
  }
  
  private async executeWithServiceRole(statement: string): Promise<{error?: any}> {
    // For functions and policies, we need service role privileges
    // This is a simplified approach - in production you'd use proper migration tools
    return await this.supabase.rpc('exec_sql', { sql: statement })
  }
  
  private isIgnorableError(errorMessage: string): boolean {
    const ignorablePatterns = [
      /already exists/i,
      /column .* of relation .* already exists/i,
      /relation .* already exists/i,
      /function .* already exists/i,
      /policy .* already exists/i,
      /role .* already exists/i
    ]
    
    return ignorablePatterns.some(pattern => pattern.test(errorMessage))
  }
  
  private async verifyMigrationSuccess(): Promise<FixResult> {
    try {
      // Check for required columns
      const { data: columns, error: colError } = await this.supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'notes')
        .in('column_name', ['error_message', 'processing_attempts', 'last_error_at'])
      
      if (colError) {
        return { success: false, message: `Column verification failed: ${colError.message}` }
      }
      
      const presentColumns = columns?.map(c => c.column_name) || []
      const requiredColumns = ['error_message', 'processing_attempts', 'last_error_at']
      const missingColumns = requiredColumns.filter(col => !presentColumns.includes(col))
      
      // Check for processing_errors table
      const { data: tables, error: tableError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'processing_errors')
        .eq('table_schema', 'public')
      
      const processingErrorsExists = tables && tables.length > 0
      
      // Check for functions
      const { data: functions, error: funcError } = await this.supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public')
        .in('routine_name', ['log_processing_error', 'clear_processing_error', 'get_processing_stats'])
      
      const presentFunctions = functions?.map(f => f.routine_name) || []
      const requiredFunctions = ['log_processing_error', 'clear_processing_error', 'get_processing_stats']
      const missingFunctions = requiredFunctions.filter(func => !presentFunctions.includes(func))
      
      const allSuccess = missingColumns.length === 0 && processingErrorsExists && missingFunctions.length === 0
      
      return {
        success: allSuccess,
        message: allSuccess 
          ? 'Migration verification successful - all components present'
          : `Migration verification found issues: ${[
              missingColumns.length > 0 ? `missing columns [${missingColumns.join(', ')}]` : '',
              !processingErrorsExists ? 'missing processing_errors table' : '',
              missingFunctions.length > 0 ? `missing functions [${missingFunctions.join(', ')}]` : ''
            ].filter(Boolean).join(', ')}`,
        details: {
          columns: { present: presentColumns, missing: missingColumns },
          tables: { processingErrorsExists },
          functions: { present: presentFunctions, missing: missingFunctions }
        }
      }
      
    } catch (error) {
      return {
        success: false,
        message: `Migration verification failed: ${error.message}`
      }
    }
  }

  private async resetStuckProcessing(): Promise<void> {
    console.log('🔄 Step 2: Resetting stuck processing locks...')
    
    try {
      // Find notes stuck in processing (processing for more than 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      
      const { data: stuckNotes, error: findError } = await this.supabase
        .from('notes')
        .select('id, title, processing_started_at')
        .not('processing_started_at', 'is', null)
        .lt('processing_started_at', thirtyMinutesAgo)

      if (findError) {
        this.results.stuckProcessing = {
          success: false,
          message: `Failed to find stuck notes: ${findError.message}`
        }
        return
      }

      const stuckCount = stuckNotes?.length || 0
      console.log(`Found ${stuckCount} notes stuck in processing`)

      if (stuckCount > 0) {
        // Reset processing locks
        const stuckIds = stuckNotes.map(note => note.id)
        
        const { error: resetError } = await this.supabase
          .from('notes')
          .update({ 
            processing_started_at: null,
            // Clear error message if it exists (with fallback for missing column)
            ...(this.results.databaseMigration.success && { error_message: null })
          })
          .in('id', stuckIds)

        if (resetError) {
          this.results.stuckProcessing = {
            success: false,
            message: `Failed to reset stuck processing: ${resetError.message}`
          }
          return
        }

        this.results.stuckProcessing = {
          success: true,
          message: `Reset ${stuckCount} stuck processing locks`,
          details: { stuckNotes: stuckNotes.map(n => ({ id: n.id, title: n.title })) }
        }
        console.log(`✅ Stuck processing: Reset ${stuckCount} locks`)
      } else {
        this.results.stuckProcessing = {
          success: true,
          message: 'No stuck processing locks found',
          details: { stuckCount: 0 }
        }
        console.log('✅ Stuck processing: No locks to reset')
      }

    } catch (error) {
      this.results.stuckProcessing = {
        success: false,
        message: `Failed to reset stuck processing: ${error.message}`
      }
      console.log(`❌ Stuck processing: ${error.message}`)
    }
  }

  private async verifyEnvironmentVariables(): Promise<void> {
    console.log('🔧 Step 3: Verifying environment variables...')
    
    try {
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY',
        'CRON_SECRET'
      ]

      const missingVars = requiredVars.filter(varName => !process.env[varName])
      const presentVars = requiredVars.filter(varName => process.env[varName])

      if (missingVars.length === 0) {
        this.results.environmentVariables = {
          success: true,
          message: 'All required environment variables are present',
          details: { presentVars, missingVars: [] }
        }
        console.log('✅ Environment variables: All required vars present')
      } else {
        this.results.environmentVariables = {
          success: false,
          message: `Missing environment variables: ${missingVars.join(', ')}`,
          details: { presentVars, missingVars }
        }
        console.log(`❌ Environment variables: Missing ${missingVars.join(', ')}`)
      }

      // Test OpenAI API connectivity if key is present
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (response.ok) {
            console.log('✅ OpenAI API: Connection successful')
          } else {
            console.log(`⚠️  OpenAI API: Connection failed (${response.status})`)
          }
        } catch (apiError) {
          console.log(`⚠️  OpenAI API: Connection test failed`)
        }
      }

    } catch (error) {
      this.results.environmentVariables = {
        success: false,
        message: `Environment check failed: ${error.message}`
      }
      console.log(`❌ Environment variables: ${error.message}`)
    }
  }

  private async testProcessingPipeline(): Promise<void> {
    console.log('🧪 Step 4: Testing processing pipeline...')
    
    try {
      // Get count of pending notes
      const { data: pendingNotes, error: countError } = await this.supabase
        .from('notes')
        .select('id, title, transcription, analysis, processed_at')
        .is('processed_at', null)
        .limit(5)

      if (countError) {
        this.results.processingPipeline = {
          success: false,
          message: `Failed to query pending notes: ${countError.message}`
        }
        return
      }

      const pendingCount = pendingNotes?.length || 0
      console.log(`Found ${pendingCount} notes ready for processing`)

      if (pendingCount === 0) {
        this.results.processingPipeline = {
          success: true,
          message: 'No notes pending processing',
          details: { pendingCount: 0 }
        }
        console.log('✅ Processing pipeline: No notes to process')
        return
      }

      // Test processing service accessibility
      try {
        const testResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'}/api/process/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET || 'test'}`,
            'x-vercel-cron': '1'
          },
          body: JSON.stringify({ batchSize: 1, dryRun: true })
        })

        if (testResponse.ok) {
          this.results.processingPipeline = {
            success: true,
            message: 'Processing pipeline endpoint accessible',
            details: { pendingCount, endpointStatus: testResponse.status }
          }
          console.log('✅ Processing pipeline: Endpoint accessible')
        } else {
          this.results.processingPipeline = {
            success: false,
            message: `Processing endpoint returned ${testResponse.status}`,
            details: { pendingCount, endpointStatus: testResponse.status }
          }
          console.log(`❌ Processing pipeline: Endpoint error ${testResponse.status}`)
        }
      } catch (fetchError) {
        this.results.processingPipeline = {
          success: false,
          message: 'Processing endpoint not accessible',
          details: { pendingCount, error: fetchError.message }
        }
        console.log(`❌ Processing pipeline: ${fetchError.message}`)
      }

    } catch (error) {
      this.results.processingPipeline = {
        success: false,
        message: `Pipeline test failed: ${error.message}`
      }
      console.log(`❌ Processing pipeline: ${error.message}`)
    }
  }

  private async validateCronEndpoint(): Promise<void> {
    console.log('⏰ Step 5: Validating cron endpoint...')
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'
      const cronUrl = `${baseUrl}/api/process/batch`

      // Test cron authentication methods
      const authTests = [
        {
          name: 'Vercel Cron Headers',
          headers: {
            'x-vercel-cron': '1',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json'
          }
        },
        {
          name: 'Bearer Token Only',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      ]

      const testResults = []

      for (const test of authTests) {
        try {
          const response = await fetch(cronUrl, {
            method: 'POST',
            headers: test.headers,
            body: JSON.stringify({ batchSize: 1, dryRun: true })
          })

          testResults.push({
            name: test.name,
            status: response.status,
            success: response.status === 200 || response.status === 429 // 429 is OK (rate limited)
          })

          console.log(`  ${test.name}: ${response.status} ${response.status === 200 ? '✅' : response.status === 429 ? '⚠️' : '❌'}`)
        } catch (fetchError) {
          testResults.push({
            name: test.name,
            status: 0,
            success: false,
            error: fetchError.message
          })
          console.log(`  ${test.name}: Failed (${fetchError.message}) ❌`)
        }
      }

      const successfulTests = testResults.filter(t => t.success)

      if (successfulTests.length > 0) {
        this.results.cronEndpoint = {
          success: true,
          message: `Cron endpoint accessible with ${successfulTests.length} auth method(s)`,
          details: { testResults, successfulMethods: successfulTests.map(t => t.name) }
        }
        console.log('✅ Cron endpoint: Authentication working')
      } else {
        this.results.cronEndpoint = {
          success: false,
          message: 'Cron endpoint authentication failed for all methods',
          details: { testResults }
        }
        console.log('❌ Cron endpoint: All authentication methods failed')
      }

    } catch (error) {
      this.results.cronEndpoint = {
        success: false,
        message: `Cron validation failed: ${error.message}`
      }
      console.log(`❌ Cron endpoint: ${error.message}`)
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 EMERGENCY FIX RESULTS')
    console.log('='.repeat(60))

    const steps = [
      { name: 'Database Migration', result: this.results.databaseMigration },
      { name: 'Stuck Processing Reset', result: this.results.stuckProcessing },
      { name: 'Environment Variables', result: this.results.environmentVariables },
      { name: 'Processing Pipeline', result: this.results.processingPipeline },
      { name: 'Cron Endpoint', result: this.results.cronEndpoint }
    ]

    let successCount = 0
    
    steps.forEach((step, index) => {
      const status = step.result.success ? '✅ PASS' : '❌ FAIL'
      console.log(`${index + 1}. ${step.name}: ${status}`)
      console.log(`   ${step.result.message}`)
      
      if (step.result.details) {
        console.log(`   Details: ${JSON.stringify(step.result.details, null, 2).slice(0, 200)}...`)
      }
      
      if (step.result.success) successCount++
      console.log()
    })

    console.log('='.repeat(60))
    console.log(`📈 SUMMARY: ${successCount}/${steps.length} steps successful`)
    
    if (successCount === steps.length) {
      console.log('🎉 All emergency fixes completed successfully!')
      console.log('🚀 Voice Memory processing should now be operational.')
    } else {
      console.log('⚠️  Some issues remain. Manual intervention may be required.')
      console.log('📖 Refer to EMERGENCY_RECOVERY_GUIDE.md for next steps.')
    }
    
    console.log('='.repeat(60))

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'emergency-fix-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        successCount,
        totalSteps: steps.length,
        overallSuccess: successCount === steps.length
      }
    }, null, 2))
    
    console.log(`📄 Detailed report saved to: ${reportPath}`)
  }
}

// Execute the emergency fix
if (require.main === module) {
  const fixer = new EmergencyFixProcessor()
  fixer.run().catch(console.error)
}

export { EmergencyFixProcessor }