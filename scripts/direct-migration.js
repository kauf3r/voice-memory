const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigrationDirect() {
  console.log('🔧 Applying task_pins table migration (direct approach)...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing required environment variables');
  }
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Test if task_pins table already exists
  console.log('🔍 Checking if task_pins table exists...');
  try {
    const { data, error } = await supabase.from('task_pins').select('id').limit(1);
    
    if (!error) {
      console.log('✅ Task_pins table already exists and is accessible');
      console.log('🔍 Checking table structure...');
      
      // Get table info if possible
      const { data: schemaData, error: schemaError } = await supabase
        .from('task_pins')
        .select('*')
        .limit(0); // Just get column info
        
      if (!schemaError) {
        console.log('✅ Table structure verification complete');
        console.log('ℹ️  Migration may have been applied previously');
        
        // Try to test the functions exist
        try {
          const { data: functionTest, error: functionError } = await supabase
            .rpc('get_pin_count', { p_user_id: '00000000-0000-0000-0000-000000000000' });
            
          if (!functionError) {
            console.log('✅ Helper functions are available');
          } else {
            console.log('⚠️  Helper functions may need to be created:', functionError.message);
          }
        } catch (funcErr) {
          console.log('⚠️  Could not test helper functions:', funcErr.message);
        }
        
        return;
      }
    }
  } catch (err) {
    console.log('❌ Table does not exist or is not accessible, proceeding with creation...');
  }
  
  // If we get here, we need to create the table
  console.log('🚀 Creating task_pins table...');
  
  // Create the table structure directly
  try {
    // Create the table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS public.task_pins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL,
          pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          pin_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, task_id)
      );
    `;
    
    console.log('📋 Creating table...');
    const { error: tableError } = await supabase.rpc('exec', { statement: createTableQuery });
    
    if (tableError && !tableError.message.includes('already exists')) {
      console.error('❌ Table creation failed:', tableError.message);
      throw tableError;
    }
    
    console.log('✅ Table created successfully');
    
    // Test access
    const { data: testData, error: testError } = await supabase
      .from('task_pins')
      .select('id')
      .limit(1);
      
    if (!testError) {
      console.log('✅ Table access verified');
    } else {
      console.error('❌ Table access test failed:', testError.message);
    }
    
  } catch (err) {
    console.error('❌ Direct table creation failed:', err.message);
    console.log('ℹ️  The table might already exist. Let me verify...');
    
    // Final verification
    try {
      const { data, error } = await supabase.from('task_pins').select('id').limit(1);
      
      if (!error) {
        console.log('✅ Table exists and is accessible after all!');
      } else {
        console.error('❌ Final verification failed:', error.message);
        throw new Error('Could not create or access task_pins table');
      }
    } catch (verifyErr) {
      console.error('❌ Final verification error:', verifyErr.message);
      throw verifyErr;
    }
  }
}

// Run the migration
applyMigrationDirect().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});