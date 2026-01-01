-- Add pin ordering functionality to task_pins table
-- This migration adds the ability to reorder pinned tasks via drag & drop

-- Add order column to task_pins table
ALTER TABLE public.task_pins ADD COLUMN pin_order INTEGER DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX task_pins_user_order_idx ON public.task_pins(user_id, pin_order ASC);

-- Update existing pins with sequential order based on pinned_at
WITH ordered_pins AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY pinned_at ASC) - 1 as new_order
    FROM public.task_pins
)
UPDATE public.task_pins 
SET pin_order = ordered_pins.new_order
FROM ordered_pins
WHERE public.task_pins.id = ordered_pins.id;

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

-- Function to get next pin order for a user (for new pins)
CREATE OR REPLACE FUNCTION public.get_next_pin_order(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(pin_order) + 1 FROM public.task_pins WHERE user_id = p_user_id),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the enforce_pin_limit function to handle ordering
CREATE OR REPLACE FUNCTION public.enforce_pin_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user already has 10 pins
    IF (SELECT COUNT(*) FROM public.task_pins WHERE user_id = NEW.user_id) >= 10 THEN
        RAISE EXCEPTION 'Pin limit exceeded. Maximum 10 tasks can be pinned per user.';
    END IF;
    
    -- Set order for new pin if not specified
    IF NEW.pin_order IS NULL THEN
        NEW.pin_order := public.get_next_pin_order(NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update helper function to return pins in order
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

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.reorder_pins(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_pin_order(UUID) TO authenticated;