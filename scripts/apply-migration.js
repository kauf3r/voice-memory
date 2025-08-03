const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration(migrationFile) {
  try {
    console.log(`📄 Reading migration file: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔄 Applying ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  Statement ${i + 1}/${statements.length}...`);
          const { data, error } = await supabase.rpc('query', { query_text: statement });
          
          if (error && error.code !== '42P07') { // Ignore "relation already exists" errors
            console.error(`    ❌ Error in statement ${i + 1}:`, error);
            console.error(`    Statement: ${statement.substring(0, 100)}...`);
          } else {
            console.log(`    ✅ Statement ${i + 1} applied successfully`);
          }
        } catch (statementError) {
          console.error(`    ❌ Error in statement ${i + 1}:`, statementError);
          console.error(`    Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log('✅ Migration application completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Get migration file from command line or use default
const migrationFile = process.argv[2] || './supabase/migrations/20250803_performance_optimization_indexes.sql';

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Migration file not found: ${migrationFile}`);
  process.exit(1);
}

applyMigration(migrationFile);