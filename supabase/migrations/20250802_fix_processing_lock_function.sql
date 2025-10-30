-- Fix acquire_processing_lock function timestamp calculation error
-- Date: 2025-08-02
-- Issue: Function uses current_time (TIME) instead of NOW() (TIMESTAMP WITH TIME ZONE)

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
    -- BUG FIX: current_time returns TIME, not TIMESTAMP WITH TIME ZONE
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

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION public.acquire_processing_lock(UUID, INTEGER) TO authenticated, service_role;