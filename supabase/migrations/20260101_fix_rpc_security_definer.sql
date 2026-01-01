-- Fix SECURITY DEFINER functions to validate auth.uid() matches p_user_id
-- This prevents privilege escalation where a user could call RPCs with another user's ID

-- Fix reorder_pins: Add user validation (preserves original signature)
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
    -- SECURITY: Verify caller owns the pins
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied: Cannot reorder pins for other users';
    END IF;

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

-- Fix get_next_pin_order: Add user validation
CREATE OR REPLACE FUNCTION public.get_next_pin_order(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    -- SECURITY: Verify caller is requesting their own data
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied: Cannot access pin order for other users';
    END IF;

    RETURN COALESCE(
        (SELECT MAX(pin_order) + 1 FROM public.task_pins WHERE user_id = p_user_id),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_pinned_task_ids: Add user validation
CREATE OR REPLACE FUNCTION public.get_pinned_task_ids(p_user_id UUID)
RETURNS TEXT[] AS $$
BEGIN
    -- SECURITY: Verify caller is requesting their own data
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied: Cannot access pinned tasks for other users';
    END IF;

    RETURN ARRAY(
        SELECT task_id
        FROM public.task_pins
        WHERE user_id = p_user_id
        ORDER BY pin_order ASC, pinned_at ASC
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments documenting security requirements
COMMENT ON FUNCTION public.reorder_pins(UUID, TEXT, INTEGER) IS
  'Reorder pinned tasks. SECURITY: Validates auth.uid() matches p_user_id to prevent privilege escalation';
COMMENT ON FUNCTION public.get_next_pin_order(UUID) IS
  'Get next pin order for user. SECURITY: Validates auth.uid() matches p_user_id';
COMMENT ON FUNCTION public.get_pinned_task_ids(UUID) IS
  'Get pinned task IDs for user. SECURITY: Validates auth.uid() matches p_user_id';
