-- Add task pinning functionality to Voice Memory
-- This migration adds the ability to pin important tasks to the top of the task list

-- Create task_pins table
CREATE TABLE public.task_pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- matches the generated task ID format (e.g., "note-id-my-0")
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, task_id) -- prevent duplicate pins
);

-- Create indexes for performance
CREATE INDEX task_pins_user_id_idx ON public.task_pins(user_id);
CREATE INDEX task_pins_task_id_idx ON public.task_pins(task_id);
CREATE INDEX task_pins_pinned_at_idx ON public.task_pins(pinned_at DESC);

-- Enable Row Level Security
ALTER TABLE public.task_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_pins
CREATE POLICY "Users can view their own task pins"
    ON public.task_pins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task pins"
    ON public.task_pins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task pins"
    ON public.task_pins FOR DELETE
    USING (auth.uid() = user_id);

-- Function to enforce pin limit (max 10 pins per user)
CREATE OR REPLACE FUNCTION public.enforce_pin_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user already has 10 pins
    IF (SELECT COUNT(*) FROM public.task_pins WHERE user_id = NEW.user_id) >= 10 THEN
        RAISE EXCEPTION 'Pin limit exceeded. Maximum 10 tasks can be pinned per user.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to enforce pin limit on insert
CREATE TRIGGER enforce_pin_limit_trigger
    BEFORE INSERT ON public.task_pins
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pin_limit();

-- Helper function to check if a task is pinned
CREATE OR REPLACE FUNCTION public.is_task_pinned(p_user_id UUID, p_task_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.task_pins 
        WHERE user_id = p_user_id AND task_id = p_task_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get all pinned task IDs for a user
CREATE OR REPLACE FUNCTION public.get_pinned_task_ids(p_user_id UUID)
RETURNS TEXT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT task_id 
        FROM public.task_pins 
        WHERE user_id = p_user_id 
        ORDER BY pinned_at ASC
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get pin count for a user
CREATE OR REPLACE FUNCTION public.get_pin_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.task_pins 
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.task_pins TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_pinned(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pinned_task_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pin_count(UUID) TO authenticated;