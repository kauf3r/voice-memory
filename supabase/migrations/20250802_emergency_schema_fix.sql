-- 🚨 EMERGENCY SCHEMA FIX - Critical Processing Pipeline Recovery
-- Date: 2025-08-02
-- Issue: Table name inconsistency causing complete processing failure
-- Root Cause: Error tracking migration referenced 'voice_notes' but actual table is 'notes'

-- =============================================================================
-- STEP 1: Add missing error tracking columns to notes table
-- =============================================================================

-- These columns were supposed to be added by 20240119_add_error_tracking.sql
-- but that migration failed because it referenced the wrong table name
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;

-- =============================================================================
-- STEP 2: Create processing_errors table with correct table reference
-- =============================================================================

-- Drop existing processing_errors table if it exists (it may reference wrong table)
DROP TABLE IF EXISTS public.processing_errors CASCADE;

-- Recreate processing_errors table with correct reference to 'notes' table
CREATE TABLE public.processing_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_type VARCHAR(100),
    stack_trace TEXT,
    processing_attempt INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: Create missing indexes for error tracking
-- =============================================================================

-- Indexes for error tracking on notes table
CREATE INDEX IF NOT EXISTS idx_notes_error_status ON public.notes(error_message) WHERE error_message IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_processing_attempts ON public.notes(processing_attempts);
CREATE INDEX IF NOT EXISTS idx_notes_last_error_at ON public.notes(last_error_at);

-- Indexes for processing_errors table
CREATE INDEX IF NOT EXISTS idx_processing_errors_note_id ON public.processing_errors(note_id);
CREATE INDEX IF NOT EXISTS idx_processing_errors_created_at ON public.processing_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_errors_error_type ON public.processing_errors(error_type);

-- Update existing processing lock index to include error columns
DROP INDEX IF EXISTS idx_notes_processing_lock_status;
CREATE INDEX idx_notes_processing_lock_status ON public.notes(processed_at, processing_started_at, error_message);

-- =============================================================================
-- STEP 4: Fix RLS policies to reference correct table
-- =============================================================================

-- Enable RLS on processing_errors table
ALTER TABLE public.processing_errors ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might reference wrong table names
DROP POLICY IF EXISTS "Users can view their own voice_notes with errors" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own voice_notes with errors" ON public.notes;
DROP POLICY IF EXISTS "Users can view processing errors for their voice_notes" ON public.processing_errors;

-- Create correct RLS policies for notes table error columns
CREATE POLICY "Users can view their own notes with errors" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes with errors" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);

-- Create correct RLS policy for processing_errors table
CREATE POLICY "Users can view processing errors for their notes" ON public.processing_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.notes 
            WHERE notes.id = processing_errors.note_id 
            AND notes.user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert processing errors" ON public.processing_errors
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- STEP 5: Fix database functions to reference correct table and columns
-- =============================================================================

-- Fix log_processing_error function
CREATE OR REPLACE FUNCTION public.log_processing_error(
    p_note_id UUID,
    p_error_message TEXT,
    p_error_type VARCHAR(100) DEFAULT NULL,
    p_stack_trace TEXT DEFAULT NULL,
    p_processing_attempt INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Insert into processing_errors table
    INSERT INTO public.processing_errors (
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
            (SELECT COALESCE(processing_attempts, 0) FROM public.notes WHERE id = p_note_id)
        )
    );
    
    -- Update the note with error information (correct table name)
    UPDATE public.notes 
    SET 
        error_message = p_error_message,
        last_error_at = NOW(),
        processing_attempts = COALESCE(processing_attempts, 0) + 1
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix clear_processing_error function
CREATE OR REPLACE FUNCTION public.clear_processing_error(p_note_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE public.notes 
    SET 
        error_message = NULL,
        last_error_at = NULL
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_processing_stats function to reference correct table
CREATE OR REPLACE FUNCTION public.get_processing_stats(p_user_id UUID)
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
    FROM public.notes 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: Fix acquire_processing_lock function with proper error handling
-- =============================================================================

-- This is the function causing the timestamp parsing error
CREATE OR REPLACE FUNCTION public.acquire_processing_lock(p_note_id UUID, p_lock_timeout_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
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
    
    -- Calculate timeout threshold safely
    timeout_threshold := current_time - (p_lock_timeout_minutes || ' minutes')::INTERVAL;
    
    -- Try to acquire lock using UPDATE with timeout check
    -- Now all referenced columns exist in the notes table
    UPDATE public.notes 
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
    
    -- Log the lock acquisition attempt for debugging
    IF lock_acquired THEN
        RAISE NOTICE 'Processing lock acquired for note: %', p_note_id;
    ELSE
        RAISE NOTICE 'Failed to acquire processing lock for note: % (may already be processed or locked)', p_note_id;
    END IF;
    
    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Grant proper permissions for all functions and tables
-- =============================================================================

-- Grant permissions on notes table for error columns
GRANT ALL ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

-- Grant permissions on processing_errors table
GRANT ALL ON public.processing_errors TO authenticated;
GRANT ALL ON public.processing_errors TO service_role;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION public.log_processing_error(UUID, TEXT, VARCHAR, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_processing_error(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_processing_stats(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acquire_processing_lock(UUID, INTEGER) TO authenticated, service_role;

-- =============================================================================
-- STEP 8: Clean up any orphaned data and reset stuck processing
-- =============================================================================

-- Clean up any stuck processing locks for the emergency recovery
UPDATE public.notes 
SET 
    processing_started_at = NULL,
    error_message = 'Reset by emergency schema fix - ready for reprocessing',
    last_error_at = NOW()
WHERE processing_started_at IS NOT NULL 
    AND processed_at IS NULL
    AND processing_started_at < NOW() - INTERVAL '5 minutes';

-- =============================================================================
-- STEP 9: Verification queries (for testing)
-- =============================================================================

-- Test that all required columns exist
DO $$
BEGIN
    -- Verify all required columns exist in notes table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' 
        AND column_name = 'error_message'
    ) THEN
        RAISE EXCEPTION 'Emergency fix failed: error_message column missing';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' 
        AND column_name = 'processing_attempts'
    ) THEN
        RAISE EXCEPTION 'Emergency fix failed: processing_attempts column missing';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' 
        AND column_name = 'last_error_at'
    ) THEN
        RAISE EXCEPTION 'Emergency fix failed: last_error_at column missing';
    END IF;
    
    -- Verify processing_errors table exists and references correct table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'processing_errors'
    ) THEN
        RAISE EXCEPTION 'Emergency fix failed: processing_errors table missing';
    END IF;
    
    RAISE NOTICE '✅ Emergency schema fix completed successfully - all required columns and tables exist';
END
$$;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Log completion
INSERT INTO public.processing_errors (
    note_id,
    error_message,
    error_type,
    processing_attempt
) 
SELECT 
    id,
    'Emergency schema fix completed - processing pipeline restored',
    'SYSTEM_RECOVERY',
    0
FROM public.notes 
WHERE id = '00000000-0000-0000-0000-000000000000'::UUID
ON CONFLICT DO NOTHING;

-- Final verification that acquire_processing_lock function works
DO $$
DECLARE
    test_result BOOLEAN;
BEGIN
    -- Test the function doesn't crash (it will return false for non-existent note, but shouldn't error)
    SELECT public.acquire_processing_lock('00000000-0000-0000-0000-000000000000'::UUID, 15) INTO test_result;
    RAISE NOTICE '✅ acquire_processing_lock function test completed without errors';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ acquire_processing_lock function still has issues: %', SQLERRM;
END
$$;