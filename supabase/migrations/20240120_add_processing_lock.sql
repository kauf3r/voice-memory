-- Migration: Add processing lock mechanism to prevent concurrent processing
-- Date: 2024-01-20

-- Add processing_started_at column to track when processing begins
ALTER TABLE notes 
ADD COLUMN processing_started_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance on processing lock
CREATE INDEX idx_notes_processing_started_at ON notes(processing_started_at) WHERE processing_started_at IS NOT NULL;
CREATE INDEX idx_notes_processing_lock_status ON notes(processed_at, processing_started_at, error_message);

-- Function to acquire processing lock for a note
CREATE OR REPLACE FUNCTION acquire_processing_lock(p_note_id UUID, p_lock_timeout_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
    timeout_threshold TIMESTAMP WITH TIME ZONE := current_time - (p_lock_timeout_minutes || ' minutes')::INTERVAL;
    affected_rows INTEGER;
BEGIN
    -- Try to acquire lock using UPDATE with timeout check
    UPDATE notes 
    SET 
        processing_started_at = current_time,
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
    
    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release processing lock (called on successful completion)
CREATE OR REPLACE FUNCTION release_processing_lock(p_note_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notes 
    SET 
        processing_started_at = NULL,
        processed_at = NOW()
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release processing lock with error (called on failure)
CREATE OR REPLACE FUNCTION release_processing_lock_with_error(
    p_note_id UUID,
    p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE notes 
    SET 
        processing_started_at = NULL,
        error_message = p_error_message,
        last_error_at = NOW()
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup abandoned processing locks
CREATE OR REPLACE FUNCTION cleanup_abandoned_processing_locks(p_timeout_minutes INTEGER DEFAULT 15)
RETURNS TABLE(cleaned_count BIGINT) AS $$
DECLARE
    timeout_threshold TIMESTAMP WITH TIME ZONE := NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    affected_rows BIGINT;
BEGIN
    -- Reset notes that have been processing for too long
    UPDATE notes 
    SET 
        processing_started_at = NULL,
        error_message = 'Processing abandoned - timeout exceeded',
        last_error_at = NOW()
    WHERE processing_started_at IS NOT NULL
        AND processing_started_at < timeout_threshold
        AND processed_at IS NULL;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN QUERY SELECT affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notes available for processing (respects locks)
CREATE OR REPLACE FUNCTION get_next_notes_for_processing(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 5,
    p_lock_timeout_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    audio_url TEXT,
    transcription TEXT,
    analysis JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE,
    processing_attempts INTEGER
) AS $$
DECLARE
    timeout_threshold TIMESTAMP WITH TIME ZONE := NOW() - (p_lock_timeout_minutes || ' minutes')::INTERVAL;
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.user_id,
        n.audio_url,
        n.transcription,
        n.analysis,
        n.recorded_at,
        n.processing_attempts
    FROM notes n
    WHERE n.processed_at IS NULL  -- Not processed
        AND n.audio_url IS NOT NULL  -- Has audio file
        AND (
            n.processing_started_at IS NULL  -- Not currently being processed
            OR n.processing_started_at < timeout_threshold  -- Or processing timeout exceeded
        )
        AND (p_user_id IS NULL OR n.user_id = p_user_id)  -- Optional user filter
    ORDER BY n.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;  -- Skip locked rows to avoid blocking
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing get_processing_stats function to account for processing locks
CREATE OR REPLACE FUNCTION get_processing_stats(p_user_id UUID)
RETURNS TABLE(
    total BIGINT,
    pending BIGINT,
    processing BIGINT,
    completed BIGINT,
    failed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (
            WHERE processed_at IS NULL 
            AND error_message IS NULL 
            AND processing_started_at IS NULL
        )::BIGINT as pending,
        COUNT(*) FILTER (
            WHERE processed_at IS NULL 
            AND processing_started_at IS NOT NULL
        )::BIGINT as processing,
        COUNT(*) FILTER (WHERE processed_at IS NOT NULL)::BIGINT as completed,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT as failed
    FROM notes 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION acquire_processing_lock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_processing_lock(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_processing_lock_with_error(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_abandoned_processing_locks(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_next_notes_for_processing(UUID, INTEGER, INTEGER) TO authenticated, service_role; 