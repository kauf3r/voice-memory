-- Fix missing task_pins table in production
-- This migration creates the task_pins table with correct auth.users reference

-- Create task_pins table (corrected version)
CREATE TABLE IF NOT EXISTS public.task_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- matches the generated task ID format (e.g., "note-id-my-0")
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    pin_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, task_id) -- prevent duplicate pins
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS task_pins_user_id_idx ON public.task_pins(user_id);
CREATE INDEX IF NOT EXISTS task_pins_task_id_idx ON public.task_pins(task_id);
CREATE INDEX IF NOT EXISTS task_pins_pinned_at_idx ON public.task_pins(pinned_at DESC);
CREATE INDEX IF NOT EXISTS task_pins_user_order_idx ON public.task_pins(user_id, pin_order ASC);

-- Enable Row Level Security
ALTER TABLE public.task_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_pins
CREATE POLICY "Users can view their own task pins"
    ON public.task_pins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task pins"
    ON public.task_pins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task pins"
    ON public.task_pins FOR UPDATE
    USING (auth.uid() = user_id);

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
    
    -- Set order for new pin if not specified
    IF NEW.pin_order IS NULL THEN
        NEW.pin_order := COALESCE(
            (SELECT MAX(pin_order) + 1 FROM public.task_pins WHERE user_id = NEW.user_id),
            0
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to enforce pin limit on insert
DROP TRIGGER IF EXISTS enforce_pin_limit_trigger ON public.task_pins;
CREATE TRIGGER enforce_pin_limit_trigger
    BEFORE INSERT ON public.task_pins
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pin_limit();

-- Function to reorder pins for a user
CREATE OR REPLACE FUNCTION public.reorder_pins(
    p_user_id UUID,
    p_task_id TEXT,
    p_new_order INTEGER
)
RETURNS VOID AS $$
DECLARE
    current_order INTEGER;
    max_order INTEGER;
BEGIN
    -- Get current order of the task being moved
    SELECT pin_order INTO current_order
    FROM public.task_pins
    WHERE user_id = p_user_id AND task_id = p_task_id;
    
    -- Get max order for this user
    SELECT COALESCE(MAX(pin_order), -1) INTO max_order
    FROM public.task_pins
    WHERE user_id = p_user_id;
    
    -- Ensure new_order is within bounds
    p_new_order := GREATEST(0, LEAST(p_new_order, max_order));
    
    -- If moving down (increasing order)
    IF p_new_order > current_order THEN
        UPDATE public.task_pins
        SET pin_order = pin_order - 1
        WHERE user_id = p_user_id 
          AND pin_order > current_order 
          AND pin_order <= p_new_order;
    -- If moving up (decreasing order)
    ELSIF p_new_order < current_order THEN
        UPDATE public.task_pins
        SET pin_order = pin_order + 1
        WHERE user_id = p_user_id 
          AND pin_order >= p_new_order 
          AND pin_order < current_order;
    END IF;
    
    -- Update the moved task's order
    UPDATE public.task_pins
    SET pin_order = p_new_order
    WHERE user_id = p_user_id AND task_id = p_task_id;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        ORDER BY pin_order ASC, pinned_at ASC -- Fallback to pinned_at for consistency
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
GRANT EXECUTE ON FUNCTION public.reorder_pins(UUID, TEXT, INTEGER) TO authenticated;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Task pins table and functions created successfully!';
END $$;