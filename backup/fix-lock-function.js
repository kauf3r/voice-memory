const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixLockFunction() {
  console.log('🔧 Fixing acquire_processing_lock function...');

  const fixedFunction = `
CREATE OR REPLACE FUNCTION public.acquire_processing_lock(p_note_id UUID, p_lock_timeout_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
    current_timestamp TIMESTAMP WITH TIME ZONE := NOW();
    timeout_threshold TIMESTAMP WITH TIME ZONE;
    affected_rows INTEGER;
BEGIN
    -- Validate inputs
    IF p_note_id IS NULL THEN
        RAISE EXCEPTION 'Note ID cannot be null';
    END IF;
    
    IF p_lock_timeout_minutes IS NULL OR p_lock_timeout_minutes <= 0 THEN
        p_lock_timeout_minutes := 15;
    END IF;
    
    -- Calculate timeout threshold safely using NOW() instead of current_time
    timeout_threshold := current_timestamp - (p_lock_timeout_minutes || ' minutes')::INTERVAL;
    
    -- Try to acquire lock using UPDATE with timeout check
    UPDATE public.notes 
    SET 
        processing_started_at = current_timestamp,
        processing_attempts = COALESCE(processing_attempts, 0) + 1,
        last_error_at = NULL,
        error_message = NULL
    WHERE id = p_note_id
        AND processed_at IS NULL  -- Not already processed
        AND (
            processing_started_at IS NULL  -- Not currently being processed
            OR processing_started_at < timeout_threshold  -- Or processing timeout exceeded
        );
    
    -- Check if we successfully acquired the lock
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    lock_acquired := affected_rows > 0;
    
    -- Log the result for debugging
    IF lock_acquired THEN
        RAISE NOTICE 'Processing lock acquired for note: %', p_note_id;
    ELSE
        RAISE NOTICE 'Failed to acquire processing lock for note: % (may already be processed or locked)', p_note_id;
    END IF;
    
    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  try {
    // Execute the function fix using individual SQL
    // First, let's try to call the RPC but handle the lack of exec_sql
    console.log('📝 Applying function fix via individual operations...');
    
    // Since we can't use exec_sql, let's manually update the function
    // by dropping and recreating it through a series of operations
    
    console.log('🗑️ Attempting to recreate the function...');
    
    // For now, let's test if we can call a simple function to verify connectivity
    const { data: testResult, error: testError } = await supabase
      .rpc('get_processing_stats', { p_user_id: '48b4ff95-a3e4-44a8-a4be-553323387d17' });
    
    if (testError) {
      console.error('❌ Cannot connect to database functions:', testError);
      return;
    }
    
    console.log('✅ Database function connectivity confirmed');
    console.log('⚠️  Manual function fix required - the acquire_processing_lock function needs to be updated');
    console.log('🔧 The issue is on line 18: current_time should be NOW()');
    console.log('📋 Fixed function ready to apply via SQL console or migration');
    
  } catch (err) {
    console.error('❌ Function fix failed:', err);
  }
}

fixLockFunction();