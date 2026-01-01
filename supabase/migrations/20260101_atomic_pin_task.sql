-- Atomic pin task function to prevent race conditions in pin order assignment
-- This replaces the non-atomic SELECT + UPDATE pattern with a single atomic operation

-- Drop existing function if it exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.pin_task_atomic(UUID, TEXT, UUID);

-- Create atomic pin task function
-- Uses SELECT FOR UPDATE to lock the user's pinned tasks during order calculation
CREATE OR REPLACE FUNCTION public.pin_task_atomic(
    p_user_id UUID,
    p_task_id TEXT,
    p_note_id UUID
)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    task_id TEXT,
    note_id UUID,
    completed BOOLEAN,
    completed_at TIMESTAMPTZ,
    pinned BOOLEAN,
    pinned_at TIMESTAMPTZ,
    pin_order INTEGER,
    archived BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_task_state_id BIGINT;
    v_current_pin_count INTEGER;
    v_next_pin_order INTEGER;
    v_already_pinned BOOLEAN;
BEGIN
    -- Validate that the caller owns this task (RLS check)
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: user_id does not match authenticated user';
    END IF;

    -- Lock all pinned tasks for this user to prevent concurrent pin order assignment
    -- This ensures only one pin operation can calculate the next order at a time
    PERFORM 1 FROM public.task_states
    WHERE task_states.user_id = p_user_id AND task_states.pinned = true
    FOR UPDATE;

    -- Check current pin count (within the lock)
    SELECT COUNT(*) INTO v_current_pin_count
    FROM public.task_states
    WHERE task_states.user_id = p_user_id AND task_states.pinned = true;

    IF v_current_pin_count >= 10 THEN
        RAISE EXCEPTION 'Pin limit exceeded. Maximum 10 tasks can be pinned per user.';
    END IF;

    -- Check if task state exists and if already pinned
    SELECT ts.id, ts.pinned INTO v_task_state_id, v_already_pinned
    FROM public.task_states ts
    WHERE ts.user_id = p_user_id AND ts.task_id = p_task_id;

    IF v_already_pinned = true THEN
        RAISE EXCEPTION 'Task is already pinned';
    END IF;

    -- Calculate next pin order atomically (within the lock)
    SELECT COALESCE(MAX(ts.pin_order), 0) + 1 INTO v_next_pin_order
    FROM public.task_states ts
    WHERE ts.user_id = p_user_id AND ts.pinned = true;

    -- Insert or update the task state
    IF v_task_state_id IS NULL THEN
        -- Create new task state
        INSERT INTO public.task_states (
            user_id,
            task_id,
            note_id,
            completed,
            pinned,
            pinned_at,
            pin_order,
            archived,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_task_id,
            p_note_id,
            false,
            true,
            NOW(),
            v_next_pin_order,
            false,
            '{}',
            NOW(),
            NOW()
        )
        RETURNING task_states.id INTO v_task_state_id;
    ELSE
        -- Update existing task state
        UPDATE public.task_states ts
        SET
            pinned = true,
            pinned_at = NOW(),
            pin_order = v_next_pin_order,
            updated_at = NOW()
        WHERE ts.id = v_task_state_id;
    END IF;

    -- Return the updated task state
    RETURN QUERY
    SELECT
        ts.id,
        ts.user_id,
        ts.task_id,
        ts.note_id,
        ts.completed,
        ts.completed_at,
        ts.pinned,
        ts.pinned_at,
        ts.pin_order,
        ts.archived,
        ts.created_at,
        ts.updated_at
    FROM public.task_states ts
    WHERE ts.id = v_task_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.pin_task_atomic(UUID, TEXT, UUID) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION public.pin_task_atomic IS
'Atomically pins a task with proper locking to prevent race conditions in pin order assignment.
Uses SELECT FOR UPDATE to lock the user''s pinned tasks during order calculation.';
