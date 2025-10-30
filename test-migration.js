const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMigration() {
  try {
    console.log('🔍 Testing task pins migration...');
    
    // Check if task_pins table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'task_pins');
    
    if (tableError) {
      console.log('❌ Error checking tables:', tableError.message);
      return;
    }
    
    if (tables && tables.length > 0) {
      console.log('✅ task_pins table exists');
      
      // Test the helper functions
      try {
        const { data: pinCount, error: countError } = await supabase.rpc('get_pin_count', { 
          p_user_id: '00000000-0000-0000-0000-000000000000' 
        });
        
        if (countError) {
          console.log('⚠️ get_pin_count function error:', countError.message);
        } else {
          console.log('✅ get_pin_count function works, count:', pinCount);
        }
      } catch (funcError) {
        console.log('⚠️ Function test failed:', funcError.message);
      }
      
    } else {
      console.log('❌ task_pins table does not exist, applying migration...');
      
      // Read and apply migration
      const migrationSQL = fs.readFileSync('./supabase/migrations/20240123_add_task_pins.sql', 'utf8');
      console.log('📝 Applying migration...');
      
      // Split migration into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
            if (error && !error.message.includes('already exists')) {
              console.log('⚠️ Statement error:', error.message);
            }
          } catch (err) {
            console.log('⚠️ Statement execution error:', err.message);
          }
        }
      }
      
      console.log('✅ Migration application completed');
    }
    
  } catch (err) {
    console.log('❌ Test failed:', err.message);
  }
}

testMigration();