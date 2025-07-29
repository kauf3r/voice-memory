-- Migration: Add error tracking to voice_notes table and create processing_errors table
-- Date: 2024-01-19

-- Add error tracking columns to voice_notes table
ALTER TABLE voice_notes 
ADD COLUMN error_message TEXT,
ADD COLUMN processing_attempts INTEGER DEFAULT 0,
ADD COLUMN last_error_at TIMESTAMP WITH TIME ZONE;

-- Create processing_errors table for detailed error logging
CREATE TABLE processing_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES voice_notes(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_type VARCHAR(100),
    stack_trace TEXT,
    processing_attempt INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_voice_notes_error_status ON voice_notes(error_message) WHERE error_message IS NOT NULL;
CREATE INDEX idx_voice_notes_processing_attempts ON voice_notes(processing_attempts);
CREATE INDEX idx_voice_notes_last_error_at ON voice_notes(last_error_at);
CREATE INDEX idx_processing_errors_note_id ON processing_errors(note_id);
CREATE INDEX idx_processing_errors_created_at ON processing_errors(created_at);
CREATE INDEX idx_processing_errors_error_type ON processing_errors(error_type);

-- Create rate_limits table for persistent rate limiting
CREATE TABLE rate_limits (
    service VARCHAR(50) PRIMARY KEY,
    requests BIGINT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for new columns and tables
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policy for voice_notes (existing users can only see their own notes)
CREATE POLICY "Users can view their own voice_notes with errors" ON voice_notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice_notes with errors" ON voice_notes
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS policy for processing_errors (users can only see errors for their own notes)
CREATE POLICY "Users can view processing errors for their voice_notes" ON processing_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM voice_notes 
            WHERE voice_notes.id = processing_errors.note_id 
            AND voice_notes.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert processing errors" ON processing_errors
    FOR INSERT WITH CHECK (true);

-- RLS policy for rate_limits (service only)
CREATE POLICY "Service can manage rate limits" ON rate_limits
    FOR ALL USING (true);

-- Create function to log processing errors
CREATE OR REPLACE FUNCTION log_processing_error(
    p_note_id UUID,
    p_error_message TEXT,
    p_error_type VARCHAR(100) DEFAULT NULL,
    p_stack_trace TEXT DEFAULT NULL,
    p_processing_attempt INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Insert into processing_errors table
    INSERT INTO processing_errors (
        note_id,
        error_message,
        error_type,
        stack_trace,
        processing_attempt
    ) VALUES (
        p_note_id,
        p_error_message,
        p_error_type,
        p_stack_trace,
        COALESCE(p_processing_attempt, 
            (SELECT processing_attempts FROM voice_notes WHERE id = p_note_id)
        )
    );
    
    -- Update the note with error information
    UPDATE voice_notes 
    SET 
        error_message = p_error_message,
        last_error_at = NOW(),
        processing_attempts = COALESCE(processing_attempts, 0) + 1
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clear processing errors
CREATE OR REPLACE FUNCTION clear_processing_error(p_note_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE voice_notes 
    SET 
        error_message = NULL,
        last_error_at = NULL
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get processing statistics
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
        COUNT(*) FILTER (WHERE processed_at IS NULL AND error_message IS NULL)::BIGINT as pending,
        COUNT(*) FILTER (WHERE processed_at IS NULL AND transcription IS NOT NULL AND analysis IS NULL)::BIGINT as processing,
        COUNT(*) FILTER (WHERE processed_at IS NOT NULL)::BIGINT as completed,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT as failed
    FROM voice_notes 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON voice_notes TO authenticated;
GRANT ALL ON processing_errors TO authenticated;
GRANT ALL ON rate_limits TO authenticated;
GRANT EXECUTE ON FUNCTION log_processing_error(UUID, TEXT, VARCHAR, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_processing_error(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_stats(UUID) TO authenticated;

-- Grant service role permissions
GRANT ALL ON voice_notes TO service_role;
GRANT ALL ON processing_errors TO service_role;
GRANT ALL ON rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION log_processing_error(UUID, TEXT, VARCHAR, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION clear_processing_error(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_processing_stats(UUID) TO service_role; 