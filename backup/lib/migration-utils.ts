import { createServiceClient } from './supabase-server'
import fs from 'fs'
import path from 'path'

export interface MigrationResult {
  success: boolean
  method: 'exec_sql' | 'rest_api' | 'manual' | 'failed'
  executed: string[]
  skipped: string[]
  failed: string[]
  error?: string
  manualSQL?: string
  instructions?: string[]
}

export interface SQLStatement {
  sql: string
  type: 'DDL' | 'DML' | 'FUNCTION' | 'POLICY' | 'INDEX' | 'TRIGGER'
  description: string
  ignorableErrors?: string[]
}

export class MigrationExecutor {
  private supabase: any
  private verbose: boolean

  constructor(verbose = true) {
    this.supabase = createServiceClient()
    this.verbose = verbose
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message)
    }
  }

  private logError(message: string): void {
    console.error(message)
  }

  private logWarning(message: string): void {
    console.warn(message)
  }

  private logSuccess(message: string): void {
    if (this.verbose) {
      console.log(`✅ ${message}`)
    }
  }

  /**
   * Parse SQL statements and categorize them
   */
  public parseSQL(sql: string): SQLStatement[] {
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    return statements.map(stmt => {
      const upperStmt = stmt.toUpperCase()
      let type: SQLStatement['type'] = 'DDL'
      let description = 'SQL statement'
      let ignorableErrors: string[] = []

      if (upperStmt.includes('CREATE FUNCTION') || upperStmt.includes('CREATE OR REPLACE FUNCTION')) {
        type = 'FUNCTION'
        description = 'Database function'
        ignorableErrors = ['already exists', 'function already exists']
      } else if (upperStmt.includes('CREATE POLICY') || upperStmt.includes('ALTER POLICY')) {
        type = 'POLICY'
        description = 'Row Level Security policy'
        ignorableErrors = ['already exists', 'policy already exists']
      } else if (upperStmt.includes('CREATE INDEX') || upperStmt.includes('CREATE UNIQUE INDEX')) {
        type = 'INDEX'
        description = 'Database index'
        ignorableErrors = ['already exists', 'index already exists']
      } else if (upperStmt.includes('CREATE TRIGGER')) {
        type = 'TRIGGER'
        description = 'Database trigger'
        ignorableErrors = ['already exists', 'trigger already exists']
      } else if (upperStmt.includes('ALTER TABLE')) {
        type = 'DDL'
        description = 'Table alteration'
        ignorableErrors = ['already exists', 'column already exists']
      } else if (upperStmt.includes('CREATE TABLE')) {
        type = 'DDL'
        description = 'Table creation'
        ignorableErrors = ['already exists', 'relation already exists']
      } else if (upperStmt.includes('INSERT') || upperStmt.includes('UPDATE') || upperStmt.includes('DELETE')) {
        type = 'DML'
        description = 'Data manipulation'
      }

      return {
        sql: stmt,
        type,
        description,
        ignorableErrors
      }
    })
  }

  /**
   * Check if exec_sql RPC function is available
   */
  public async isExecSqlAvailable(): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql: 'SELECT 1' })
      return !error || !error.message.includes('function exec_sql does not exist')
    } catch (error) {
      return false
    }
  }

  /**
   * Execute SQL using exec_sql RPC function
   */
  private async executeWithRPC(statements: SQLStatement[]): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      method: 'exec_sql',
      executed: [],
      skipped: [],
      failed: []
    }

    this.log('🚀 Executing migration using exec_sql RPC...')

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      this.log(`⏳ [${i + 1}/${statements.length}] ${stmt.description}...`)

      try {
        const { error } = await this.supabase.rpc('exec_sql', { sql: stmt.sql })

        if (error) {
          const isIgnorable = stmt.ignorableErrors?.some(ignorable => 
            error.message.toLowerCase().includes(ignorable.toLowerCase())
          )

          if (isIgnorable) {
            this.logWarning(`⚠️  Skipped (${error.message}): ${stmt.description}`)
            result.skipped.push(stmt.sql)
          } else {
            this.logError(`❌ Failed: ${error.message}`)
            result.failed.push(stmt.sql)
            result.success = false
          }
        } else {
          this.logSuccess(`${stmt.description}`)
          result.executed.push(stmt.sql)
        }
      } catch (execError: any) {
        this.logError(`❌ Exception: ${execError.message}`)
        result.failed.push(stmt.sql)
        result.success = false
      }
    }

    return result
  }

  /**
   * Execute SQL using Supabase REST API directly
   */
  private async executeWithRestAPI(statements: SQLStatement[]): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      method: 'rest_api',
      executed: [],
      skipped: [],
      failed: []
    }

    this.log('🔄 Executing migration using REST API fallback...')

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      this.log(`⏳ [${i + 1}/${statements.length}] ${stmt.description}...`)

      try {
        // For DDL statements, we can sometimes use the .sql() method
        // This is a fallback that works with some Supabase client versions
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql: stmt.sql })
        })

        if (response.ok) {
          this.logSuccess(`${stmt.description}`)
          result.executed.push(stmt.sql)
        } else {
          const errorText = await response.text()
          const isIgnorable = stmt.ignorableErrors?.some(ignorable => 
            errorText.toLowerCase().includes(ignorable.toLowerCase())
          )

          if (isIgnorable) {
            this.logWarning(`⚠️  Skipped (${errorText}): ${stmt.description}`)
            result.skipped.push(stmt.sql)
          } else {
            this.logError(`❌ REST API failed: ${errorText}`)
            result.failed.push(stmt.sql)
            result.success = false
          }
        }
      } catch (error: any) {
        this.logError(`❌ REST API exception: ${error.message}`)
        result.failed.push(stmt.sql)
        result.success = false
      }
    }

    return result
  }

  /**
   * Generate manual execution instructions and SQL file
   */
  private async generateManualInstructions(statements: SQLStatement[]): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      method: 'manual',
      executed: [],
      skipped: [],
      failed: statements.map(s => s.sql),
      instructions: [],
      manualSQL: ''
    }

    this.log('📝 Generating manual execution instructions...')

    // Create formatted SQL for manual execution
    const formattedSQL = statements.map((stmt, index) => {
      return `-- Statement ${index + 1}: ${stmt.description}
-- Type: ${stmt.type}
${stmt.sql};

`
    }).join('')

    // Generate timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sqlFile = path.join(process.cwd(), `manual-migration-${timestamp}.sql`)

    try {
      fs.writeFileSync(sqlFile, formattedSQL)
      this.logSuccess(`SQL file generated: ${sqlFile}`)
    } catch (error) {
      this.logError(`Failed to write SQL file: ${error}`)
    }

    result.manualSQL = formattedSQL
    result.instructions = [
      '🚨 Automated migration failed. Manual execution required.',
      '',
      '📋 Manual Execution Options:',
      '',
      '1. 🌐 Supabase Dashboard Method:',
      '   • Open your Supabase project dashboard',
      '   • Go to SQL Editor tab',
      '   • Create a new query',
      '   • Copy and paste the SQL statements below',
      '   • Execute each statement individually',
      '   • Ignore "already exists" errors',
      '',
      '2. 📁 SQL File Method:',
      `   • Use the generated file: ${sqlFile}`,
      '   • Import this file in Supabase SQL Editor',
      '   • Execute the statements',
      '',
      '3. 🔧 CLI Method (if you have Supabase CLI):',
      '   • Run: supabase db reset',
      '   • Or: supabase db push',
      '',
      '4. 🐘 Direct Database Access:',
      '   • Connect to your PostgreSQL database directly',
      '   • Execute the SQL statements using psql or pgAdmin',
      '',
      '⚠️  Important Notes:',
      '   • Execute statements in the order provided',
      '   • Some statements may fail if already applied (this is normal)',
      '   • Pay attention to function and policy statements',
      '   • Verify the migration succeeded by running verification scripts',
      '',
      '🔍 SQL Statements to Execute:',
      '===============================',
      ''
    ]

    // Add each statement with clear formatting
    statements.forEach((stmt, index) => {
      result.instructions!.push(`-- ${index + 1}. ${stmt.description} (${stmt.type})`)
      result.instructions!.push(stmt.sql + ';')
      result.instructions!.push('')
    })

    result.instructions!.push('')
    result.instructions!.push('✅ After manual execution:')
    result.instructions!.push('   1. Run verification scripts to confirm migration success')
    result.instructions!.push('   2. Test the application functionality')
    result.instructions!.push('   3. Delete the manual SQL file if no longer needed')

    return result
  }

  /**
   * Execute migration with comprehensive fallback mechanisms
   */
  public async executeMigration(sql: string): Promise<MigrationResult> {
    const statements = this.parseSQL(sql)
    
    if (statements.length === 0) {
      return {
        success: true,
        method: 'exec_sql',
        executed: [],
        skipped: [],
        failed: []
      }
    }

    this.log(`🔍 Parsed ${statements.length} SQL statements`)

    // Method 1: Try exec_sql RPC
    this.log('🧪 Checking exec_sql availability...')
    const hasExecSql = await this.isExecSqlAvailable()

    if (hasExecSql) {
      this.log('✅ exec_sql RPC function is available')
      const result = await this.executeWithRPC(statements)
      
      if (result.success || result.executed.length > 0) {
        return result
      }
      
      this.logWarning('🔄 exec_sql failed, trying REST API fallback...')
    } else {
      this.logWarning('⚠️  exec_sql RPC function not available, using fallbacks...')
    }

    // Method 2: Try REST API fallback
    const restResult = await this.executeWithRestAPI(statements)
    
    if (restResult.success || restResult.executed.length > 0) {
      return restResult
    }

    // Method 3: Generate manual instructions
    this.logWarning('📋 Automated execution failed, generating manual instructions...')
    return await this.generateManualInstructions(statements)
  }

  /**
   * Execute migration from file
   */
  public async executeMigrationFile(filePath: string): Promise<MigrationResult> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
      const sql = fs.readFileSync(fullPath, 'utf8')
      
      this.log(`📄 Loading migration from: ${fullPath}`)
      return await this.executeMigration(sql)
    } catch (error: any) {
      return {
        success: false,
        method: 'failed',
        executed: [],
        skipped: [],
        failed: [],
        error: `Failed to read migration file: ${error.message}`
      }
    }
  }

  /**
   * Print migration result summary
   */
  public printResult(result: MigrationResult): void {
    console.log('\n📊 Migration Result Summary:')
    console.log('============================')
    console.log(`Method: ${result.method}`)
    console.log(`Success: ${result.success ? '✅' : '❌'}`)
    console.log(`Executed: ${result.executed.length}`)
    console.log(`Skipped: ${result.skipped.length}`)
    console.log(`Failed: ${result.failed.length}`)

    if (result.error) {
      console.log(`Error: ${result.error}`)
    }

    if (result.instructions) {
      console.log('\n' + result.instructions.join('\n'))
    }

    if (result.method === 'manual') {
      console.log('\n🔗 Next Steps:')
      console.log('1. Execute the SQL statements manually using one of the methods above')
      console.log('2. Run migration verification to confirm success')
      console.log('3. Test your application to ensure everything works')
    }
  }
}

/**
 * Convenience function to execute a migration with full fallback support
 */
export async function executeMigrationWithFallbacks(
  sql: string, 
  verbose = true
): Promise<MigrationResult> {
  const executor = new MigrationExecutor(verbose)
  const result = await executor.executeMigration(sql)
  executor.printResult(result)
  return result
}

/**
 * Convenience function to execute a migration file with full fallback support
 */
export async function executeMigrationFileWithFallbacks(
  filePath: string, 
  verbose = true
): Promise<MigrationResult> {
  const executor = new MigrationExecutor(verbose)
  const result = await executor.executeMigrationFile(filePath)
  executor.printResult(result)
  return result
} 