-- Add task completion functionality to Voice Memory
-- This migration adds the ability to mark tasks as complete with persistent storage

-- Create task_completions table
CREATE TABLE public.task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- matches the generated task ID format (e.g., "note-id-my-0")
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_by TEXT, -- for tracking who completed delegated tasks
    notes TEXT, -- optional completion notes from user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, task_id) -- prevent duplicate completions
);

-- Create indexes for performance
CREATE INDEX task_completions_user_id_idx ON public.task_completions(user_id);
CREATE INDEX task_completions_task_id_idx ON public.task_completions(task_id);
CREATE INDEX task_completions_note_id_idx ON public.task_completions(note_id);
CREATE INDEX task_completions_completed_at_idx ON public.task_completions(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_completions
CREATE POLICY "Users can view their own task completions"
    ON public.task_completions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task completions"
    ON public.task_completions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task completions"
    ON public.task_completions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task completions"
    ON public.task_completions FOR DELETE
    USING (auth.uid() = user_id);

-- Helper function to get completion stats for a user
CREATE OR REPLACE FUNCTION public.get_task_completion_stats(p_user_id UUID)
RETURNS TABLE (
    total_tasks INTEGER,
    completed_tasks INTEGER,
    completion_rate NUMERIC,
    my_tasks_completed INTEGER,
    delegated_tasks_completed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH task_data AS (
        SELECT 
            n.id as note_id,
            jsonb_array_length(COALESCE(n.analysis->'tasks'->'myTasks', '[]'::jsonb)) as my_task_count,
            jsonb_array_length(COALESCE(n.analysis->'tasks'->'delegatedTasks', '[]'::jsonb)) as delegated_task_count
        FROM public.notes n
        WHERE n.user_id = p_user_id 
          AND n.analysis IS NOT NULL
          AND (n.analysis->'tasks'->'myTasks' IS NOT NULL OR n.analysis->'tasks'->'delegatedTasks' IS NOT NULL)
    ),
    totals AS (
        SELECT 
            COALESCE(SUM(my_task_count), 0) + COALESCE(SUM(delegated_task_count), 0) as total,
            COALESCE(SUM(my_task_count), 0) as my_total,
            COALESCE(SUM(delegated_task_count), 0) as delegated_total
        FROM task_data
    ),
    completions AS (
        SELECT 
            COUNT(*) as completed,
            COUNT(*) FILTER (WHERE tc.task_id LIKE '%-my-%') as my_completed,
            COUNT(*) FILTER (WHERE tc.task_id LIKE '%-delegated-%') as delegated_completed
        FROM public.task_completions tc
        WHERE tc.user_id = p_user_id
    )
    SELECT 
        totals.total::INTEGER,
        completions.completed::INTEGER,
        CASE 
            WHEN totals.total > 0 THEN ROUND((completions.completed::NUMERIC / totals.total::NUMERIC) * 100, 1)
            ELSE 0::NUMERIC
        END as completion_rate,
        completions.my_completed::INTEGER,
        completions.delegated_completed::INTEGER
    FROM totals, completions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if a specific task is completed
CREATE OR REPLACE FUNCTION public.is_task_completed(p_user_id UUID, p_task_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.task_completions 
        WHERE user_id = p_user_id AND task_id = p_task_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get completion details for a task
CREATE OR REPLACE FUNCTION public.get_task_completion_details(p_user_id UUID, p_task_id TEXT)
RETURNS TABLE (
    completed BOOLEAN,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.id IS NOT NULL as completed,
        tc.completed_at,
        tc.completed_by,
        tc.notes
    FROM public.task_completions tc
    WHERE tc.user_id = p_user_id AND tc.task_id = p_task_id;
    
    -- If no completion found, return default values
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, NULL::TEXT, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.task_completions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_completion_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_completed(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_completion_details(UUID, TEXT) TO authenticated;