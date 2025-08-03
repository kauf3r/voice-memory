# Migration Fallback System

This document explains the comprehensive migration fallback system that handles cases where the `exec_sql` RPC function is not available in your Supabase setup.

## Overview

The migration system provides multiple execution strategies with automatic fallbacks:

1. **Primary Method**: `exec_sql` RPC function (if available)
2. **Fallback 1**: Direct REST API calls to Supabase
3. **Fallback 2**: Generate manual execution instructions
4. **Fallback 3**: Export formatted SQL files for manual use

## Key Features

- ✅ **Automatic Detection**: Checks if `exec_sql` RPC is available
- 🔄 **Multiple Fallbacks**: Progressive fallback strategies
- 🧠 **Smart Error Handling**: Recognizes ignorable errors (e.g., "already exists")
- 📊 **Comprehensive Reporting**: Detailed results with next steps
- 📄 **SQL Export**: Generates manual migration files when needed
- 🔧 **Statement Categorization**: Identifies DDL, DML, functions, policies, etc.

## Usage

### Method 1: Convenience Functions

```typescript
import { 
  executeMigrationWithFallbacks, 
  executeMigrationFileWithFallbacks 
} from '../lib/migration-utils'

// Execute SQL string with fallbacks
const result = await executeMigrationWithFallbacks(`
  CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
  );
`)

// Execute migration file with fallbacks
const result = await executeMigrationFileWithFallbacks(
  'supabase/migrations/20240119_add_error_tracking.sql'
)
```

### Method 2: Advanced Usage with MigrationExecutor

```typescript
import { MigrationExecutor } from '../lib/migration-utils'

const executor = new MigrationExecutor(true) // verbose = true

// Check availability
const hasExecSql = await executor.isExecSqlAvailable()

// Parse SQL to understand statements
const statements = executor.parseSQL(sql)

// Execute with full control
const result = await executor.executeMigration(sql)
executor.printResult(result)
```

## Migration Result Object

```typescript
interface MigrationResult {
  success: boolean                           // Overall success status
  method: 'exec_sql' | 'rest_api' | 'manual' | 'failed'  // Execution method used
  executed: string[]                         // Successfully executed statements
  skipped: string[]                         // Skipped statements (ignorable errors)
  failed: string[]                          // Failed statements
  error?: string                            // Error message if failed
  manualSQL?: string                        // Formatted SQL for manual execution
  instructions?: string[]                   // Step-by-step manual instructions
}
```

## Fallback Strategies

### 1. exec_sql RPC Function (Primary)

The preferred method when available. Executes SQL directly through Supabase's RPC function.

```typescript
const { error } = await supabase.rpc('exec_sql', { sql: statement })
```

### 2. REST API Fallback

When `exec_sql` is not available, attempts direct REST API calls:

```typescript
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sql: statement })
})
```

### 3. Manual Execution Instructions

When automated methods fail, generates comprehensive manual instructions:

- **Supabase Dashboard Method**: Step-by-step dashboard usage
- **SQL File Method**: Generated `.sql` file for import
- **CLI Method**: Supabase CLI commands
- **Direct Database Access**: PostgreSQL connection instructions

### 4. SQL File Export

Creates formatted SQL files with:
- Clear statement descriptions
- Statement types (DDL, FUNCTION, POLICY, etc.)
- Execution order preservation
- Comments and metadata

## Error Handling

### Ignorable Errors

The system automatically ignores expected errors:

- `already exists`
- `column already exists`
- `relation already exists`
- `function already exists`
- `policy already exists`
- `index already exists`

### Statement Categorization

SQL statements are automatically categorized:

- **DDL**: Data Definition Language (CREATE TABLE, ALTER TABLE)
- **DML**: Data Manipulation Language (INSERT, UPDATE, DELETE)
- **FUNCTION**: Database functions
- **POLICY**: Row Level Security policies
- **INDEX**: Database indexes
- **TRIGGER**: Database triggers

## Updated Migration Scripts

The following scripts have been updated to use the new fallback system:

### Core Migration Scripts

- `scripts/apply-migration.ts` - Basic migration application
- `scripts/quick-migration-apply.ts` - Batch migration with fallbacks
- `scripts/immediate-migration-fix.ts` - Emergency migration fixes

### Usage Examples

```bash
# Apply single migration with fallbacks
npx tsx scripts/apply-migration.ts

# Apply all migrations with comprehensive fallbacks
npx tsx scripts/quick-migration-apply.ts

# Emergency migration fix with fallbacks
npx tsx scripts/immediate-migration-fix.ts

# Demonstration of all fallback methods
npx tsx scripts/demo-migration-fallbacks.ts
```

## Manual Execution Guide

When automated migration fails, follow these steps:

### Option 1: Supabase Dashboard

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the provided SQL statements
5. Execute each statement individually
6. Ignore "already exists" errors

### Option 2: Generated SQL File

1. Use the generated `manual-migration-YYYY-MM-DD.sql` file
2. Import the file in Supabase SQL Editor
3. Execute the statements in order
4. Verify completion using verification scripts

### Option 3: Supabase CLI

```bash
# Reset and apply all migrations
supabase db reset

# Or push current migrations
supabase db push
```

### Option 4: Direct Database Access

```bash
# Connect using psql
psql "postgresql://[user]:[password]@[host]:[port]/[database]"

# Execute the migration SQL
\i manual-migration-YYYY-MM-DD.sql
```

## Best Practices

### 1. Always Use Fallback-Enabled Scripts

Replace direct `exec_sql` calls with the new migration utilities:

```typescript
// ❌ Old way (no fallbacks)
const { error } = await supabase.rpc('exec_sql', { sql: statement })

// ✅ New way (with fallbacks)
const result = await executeMigrationWithFallbacks(sql)
```

### 2. Handle Manual Execution Cases

Always check for manual execution requirements:

```typescript
const result = await executeMigrationWithFallbacks(sql)

if (result.method === 'manual') {
  console.log('⚠️  Manual execution required')
  console.log('Follow the instructions provided above')
  // Exit or prompt user to complete manual steps
}
```

### 3. Verify Migration Success

Always run verification after migration:

```typescript
// Run verification scripts
await runVerificationScripts()

// Test application functionality
await testApplicationFeatures()
```

### 4. Monitor and Log Results

Use the comprehensive result reporting:

```typescript
const executor = new MigrationExecutor(true)
const result = await executor.executeMigration(sql)

// Print detailed results
executor.printResult(result)

// Log for monitoring
console.log(`Migration: ${result.method}, Success: ${result.success}`)
```

## Troubleshooting

### Common Issues

1. **exec_sql function not available**
   - Solution: Use fallback methods or enable the function in Supabase

2. **REST API calls failing**
   - Check Supabase URL and service key
   - Verify API permissions

3. **Manual execution required**
   - Follow provided instructions
   - Use generated SQL files
   - Consider using Supabase CLI

### Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
```

### Verification

After migration, verify success:

```bash
# Run migration verification
npx tsx scripts/verify-migration.ts

# Check database schema
npx tsx scripts/check-database-schema.ts

# Test application functionality
npm run test
```

## Migration File Structure

Generated manual migration files follow this structure:

```sql
-- Statement 1: Table creation (DDL)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL
);

-- Statement 2: Database function (FUNCTION)
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS BIGINT AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM users);
END;
$$ LANGUAGE plpgsql;

-- Statement 3: Database index (INDEX)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## Integration with Existing Scripts

The new system is backward-compatible and can be integrated into existing scripts:

```typescript
// Replace existing migration logic
import { MigrationExecutor } from '../lib/migration-utils'

class ExistingMigrationScript {
  private migrationExecutor: MigrationExecutor

  constructor() {
    this.migrationExecutor = new MigrationExecutor(true)
  }

  async migrate() {
    const result = await this.migrationExecutor.executeMigrationFile(
      'path/to/migration.sql'
    )
    
    if (!result.success && result.method !== 'manual') {
      throw new Error(`Migration failed: ${result.error}`)
    }
    
    return result
  }
}
```

This comprehensive fallback system ensures that migrations can always be executed, either automatically or through clear manual procedures, regardless of the Supabase setup configuration. 