-- Unified Task States System for Voice Memory
-- This migration creates a comprehensive task management system with unified states

-- Create unified task_states table to replace separate completion and pin tables
CREATE TABLE public.task_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- matches the generated task ID format
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    
    -- Status fields
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    completed_by TEXT NULL,
    completion_notes TEXT NULL,
    
    pinned BOOLEAN DEFAULT FALSE,
    pinned_at TIMESTAMP WITH TIME ZONE NULL,
    pin_order INTEGER NULL,
    
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Metadata stored as JSONB for flexibility
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, task_id), -- one state per task per user
    CHECK (pin_order IS NULL OR pin_order >= 0) -- pin order must be positive
);

-- Create task edit history table for audit trail
CREATE TABLE public.task_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    
    -- What changed
    field_name TEXT NOT NULL, -- 'description', 'assignedTo', 'nextSteps', etc.
    old_value TEXT NULL,
    new_value TEXT NULL,
    
    -- When and why
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edit_reason TEXT NULL,
    
    -- Reference to the task state
    task_state_id UUID REFERENCES public.task_states(id) ON DELETE CASCADE
);

-- Create performance indexes
CREATE INDEX idx_task_states_user_id ON public.task_states(user_id);
CREATE INDEX idx_task_states_task_id ON public.task_states(task_id);
CREATE INDEX idx_task_states_note_id ON public.task_states(note_id);
CREATE INDEX idx_task_states_user_task ON public.task_states(user_id, task_id);

-- Composite indexes for common queries
CREATE INDEX idx_task_states_user_completed ON public.task_states(user_id, completed) WHERE completed = true;
CREATE INDEX idx_task_states_user_pinned ON public.task_states(user_id, pinned, pin_order) WHERE pinned = true;
CREATE INDEX idx_task_states_user_archived ON public.task_states(user_id, archived) WHERE archived = true;

-- Indexes for task edit history
CREATE INDEX idx_task_edit_history_user_id ON public.task_edit_history(user_id);
CREATE INDEX idx_task_edit_history_task_id ON public.task_edit_history(task_id);
CREATE INDEX idx_task_edit_history_edited_at ON public.task_edit_history(edited_at DESC);

-- Enable Row Level Security
ALTER TABLE public.task_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_edit_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_states
CREATE POLICY "Users can view their own task states"
    ON public.task_states FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task states"
    ON public.task_states FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task states"
    ON public.task_states FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task states"
    ON public.task_states FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for task_edit_history
CREATE POLICY "Users can view their own task edit history"
    ON public.task_edit_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task edit history"
    ON public.task_edit_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Helper functions for task state management

-- Function to get or create task state
CREATE OR REPLACE FUNCTION public.get_or_create_task_state(
    p_user_id UUID,
    p_task_id TEXT,
    p_note_id UUID
) RETURNS UUID AS $$
DECLARE
    state_id UUID;
BEGIN
    -- Try to get existing state
    SELECT id INTO state_id 
    FROM public.task_states 
    WHERE user_id = p_user_id AND task_id = p_task_id;
    
    -- Create if doesn't exist
    IF state_id IS NULL THEN
        INSERT INTO public.task_states (user_id, task_id, note_id)
        VALUES (p_user_id, p_task_id, p_note_id)
        RETURNING id INTO state_id;
    END IF;
    
    RETURN state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update task state with history tracking
CREATE OR REPLACE FUNCTION public.update_task_state_with_history(
    p_user_id UUID,
    p_task_id TEXT,
    p_note_id UUID,
    p_field_name TEXT,
    p_new_value TEXT,
    p_edit_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    state_id UUID;
    old_value TEXT;
    update_query TEXT;
BEGIN
    -- Get or create task state
    state_id := public.get_or_create_task_state(p_user_id, p_task_id, p_note_id);
    
    -- Get current value for history
    CASE p_field_name
        WHEN 'completed' THEN
            SELECT completed::TEXT INTO old_value FROM public.task_states WHERE id = state_id;
        WHEN 'pinned' THEN
            SELECT pinned::TEXT INTO old_value FROM public.task_states WHERE id = state_id;
        WHEN 'archived' THEN
            SELECT archived::TEXT INTO old_value FROM public.task_states WHERE id = state_id;
        WHEN 'completion_notes' THEN
            SELECT completion_notes INTO old_value FROM public.task_states WHERE id = state_id;
        WHEN 'completed_by' THEN
            SELECT completed_by INTO old_value FROM public.task_states WHERE id = state_id;
        ELSE
            -- For metadata fields, extract from JSONB
            SELECT metadata ->> p_field_name INTO old_value FROM public.task_states WHERE id = state_id;
    END CASE;
    
    -- Only proceed if value actually changed
    IF old_value IS DISTINCT FROM p_new_value THEN
        -- Record the change in history
        INSERT INTO public.task_edit_history 
            (user_id, task_id, note_id, field_name, old_value, new_value, edit_reason, task_state_id)
        VALUES 
            (p_user_id, p_task_id, p_note_id, p_field_name, old_value, p_new_value, p_edit_reason, state_id);
        
        -- Update the task state
        CASE p_field_name
            WHEN 'completed' THEN
                UPDATE public.task_states 
                SET completed = p_new_value::BOOLEAN,
                    completed_at = CASE WHEN p_new_value::BOOLEAN THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE id = state_id;
            WHEN 'pinned' THEN
                UPDATE public.task_states 
                SET pinned = p_new_value::BOOLEAN,
                    pinned_at = CASE WHEN p_new_value::BOOLEAN THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE id = state_id;
            WHEN 'archived' THEN
                UPDATE public.task_states 
                SET archived = p_new_value::BOOLEAN,
                    archived_at = CASE WHEN p_new_value::BOOLEAN THEN NOW() ELSE NULL END,
                    updated_at = NOW()
                WHERE id = state_id;
            WHEN 'completion_notes' THEN
                UPDATE public.task_states 
                SET completion_notes = p_new_value,
                    updated_at = NOW()
                WHERE id = state_id;
            WHEN 'completed_by' THEN
                UPDATE public.task_states 
                SET completed_by = p_new_value,
                    updated_at = NOW()
                WHERE id = state_id;
            ELSE
                -- Update metadata field
                UPDATE public.task_states 
                SET metadata = metadata || jsonb_build_object(p_field_name, p_new_value),
                    updated_at = NOW()
                WHERE id = state_id;
        END CASE;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive task stats
CREATE OR REPLACE FUNCTION public.get_task_stats(p_user_id UUID)
RETURNS TABLE (
    total_tasks INTEGER,
    completed_tasks INTEGER,
    pinned_tasks INTEGER,
    archived_tasks INTEGER,
    active_tasks INTEGER
) AS $$
BEGIN
    -- Get tasks from notes analysis
    WITH task_counts AS (
        SELECT 
            COUNT(*) as total_from_notes
        FROM public.notes n
        WHERE n.user_id = p_user_id 
        AND n.analysis IS NOT NULL
        AND EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(n.analysis) = 'string' 
                    THEN (n.analysis #>> '{}')::jsonb 
                    ELSE n.analysis 
                END -> 'tasks'
            ) AS task
            WHERE task IS NOT NULL
        )
    ),
    state_counts AS (
        SELECT 
            COUNT(*) FILTER (WHERE ts.completed = true) as completed,
            COUNT(*) FILTER (WHERE ts.pinned = true) as pinned,
            COUNT(*) FILTER (WHERE ts.archived = true) as archived
        FROM public.task_states ts
        WHERE ts.user_id = p_user_id
    )
    SELECT 
        COALESCE(tc.total_from_notes, 0)::INTEGER,
        COALESCE(sc.completed, 0)::INTEGER,
        COALESCE(sc.pinned, 0)::INTEGER,
        COALESCE(sc.archived, 0)::INTEGER,
        (COALESCE(tc.total_from_notes, 0) - COALESCE(sc.archived, 0))::INTEGER
    FROM task_counts tc
    CROSS JOIN state_counts sc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: Preserve existing data from task_completions and task_pins
-- Insert data from task_completions
INSERT INTO public.task_states (user_id, task_id, note_id, completed, completed_at, completed_by, completion_notes)
SELECT 
    tc.user_id,
    tc.task_id,
    tc.note_id,
    true, -- completed = true since record exists
    tc.completed_at,
    tc.completed_by,
    tc.notes
FROM public.task_completions tc
ON CONFLICT (user_id, task_id) DO UPDATE SET
    completed = true,
    completed_at = EXCLUDED.completed_at,
    completed_by = EXCLUDED.completed_by,
    completion_notes = EXCLUDED.completion_notes,
    updated_at = NOW();

-- Insert data from task_pins (merge with existing states)
INSERT INTO public.task_states (user_id, task_id, note_id, pinned, pinned_at, pin_order)
SELECT 
    tp.user_id,
    tp.task_id,
    tp.note_id,
    true, -- pinned = true since record exists
    tp.pinned_at,
    tp.pin_order
FROM public.task_pins tp
ON CONFLICT (user_id, task_id) DO UPDATE SET
    pinned = true,
    pinned_at = EXCLUDED.pinned_at,
    pin_order = EXCLUDED.pin_order,
    updated_at = NOW();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.task_states TO authenticated;
GRANT ALL ON public.task_edit_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_task_state(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task_state_with_history(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_stats(UUID) TO authenticated;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_states_updated_at
    BEFORE UPDATE ON public.task_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();