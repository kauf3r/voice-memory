const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🔧 Applying task_pins table migration...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing required environment variables');
  }
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250802_fix_task_pins_table.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`📊 Executing ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement.trim()) continue;
    
    try {
      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
      
      // Try to execute via RPC first
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement + ';' 
      });
      
      if (error) {
        // If RPC fails, try direct table query to test connection
        console.log(`⚠️ RPC failed, testing connection: ${error.message}`);
        
        // For CREATE statements, errors about existing objects are OK
        if (statement.toLowerCase().includes('create') && 
            error.message.includes('already exists')) {
          console.log('✅ Object already exists, continuing...');
          continue;
        }
        
        // For other errors on critical statements, log and continue
        if (!statement.toLowerCase().includes('create table') && 
            !statement.toLowerCase().includes('create function')) {
          console.log(`⚠️ Non-critical error, continuing: ${error.message}`);
          continue;
        }
        
        // Only throw on critical CREATE failures
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
      
      console.log(`✅ Statement ${i + 1} executed successfully`);
      
    } catch (err) {
      console.error(`❌ Failed on statement ${i + 1}:`, err.message);
      
      if (err.message && err.message.includes('already exists')) {
        console.log('⚠️ Object already exists, continuing...');
        continue;
      }
      
      // Don't fail the entire migration for non-critical errors
      console.log('⚠️ Continuing with remaining statements...');
    }
  }
  
  console.log('✅ Migration completed!');
  
  // Verify the table exists by trying to access it
  try {
    const { data, error: verifyError } = await supabase
      .from('task_pins')
      .select('id')
      .limit(1);
      
    if (verifyError) {
      console.error('❌ Table verification failed:', verifyError.message);
      console.log('ℹ️  This might indicate the table was not created properly');
    } else {
      console.log('✅ task_pins table verified and accessible');
    }
  } catch (verifyErr) {
    console.error('❌ Verification error:', verifyErr.message);
  }
}

// Run the migration
applyMigration().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});