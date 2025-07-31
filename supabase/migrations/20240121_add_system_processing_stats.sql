-- Add system-level processing stats function for administrative use
-- This function doesn't require a user_id parameter and provides global statistics

-- Fix the existing get_processing_stats function to use correct table name
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
    FROM notes  -- Fixed: was voice_notes in some migrations
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create system-level processing stats function (no user_id required)
CREATE OR REPLACE FUNCTION get_system_processing_stats()
RETURNS TABLE(
    total BIGINT,
    pending BIGINT,
    processing BIGINT,
    completed BIGINT,
    failed BIGINT,
    users_with_notes BIGINT,
    avg_processing_time_minutes NUMERIC,
    error_rate NUMERIC
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
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT as failed,
        COUNT(DISTINCT user_id)::BIGINT as users_with_notes,
        COALESCE(
            AVG(
                EXTRACT(EPOCH FROM (processed_at - created_at)) / 60
            ) FILTER (WHERE processed_at IS NOT NULL),
            0
        )::NUMERIC as avg_processing_time_minutes,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (COUNT(*) FILTER (WHERE error_message IS NOT NULL)::NUMERIC / COUNT(*)::NUMERIC * 100)
            ELSE 0
        END::NUMERIC as error_rate
    FROM notes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create system health check function for quick status overview
CREATE OR REPLACE FUNCTION get_system_health_stats()
RETURNS TABLE(
    status TEXT,
    total_notes BIGINT,
    stuck_processing BIGINT,
    recent_errors BIGINT,
    system_healthy BOOLEAN
) AS $$
DECLARE
    stuck_threshold TIMESTAMP := NOW() - INTERVAL '10 minutes';
    recent_threshold TIMESTAMP := NOW() - INTERVAL '1 hour';
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN COUNT(*) FILTER (WHERE processing_started_at < stuck_threshold AND processed_at IS NULL AND error_message IS NULL) > 0 
                THEN 'WARNING: Stuck processing detected'
            WHEN COUNT(*) FILTER (WHERE error_message IS NOT NULL AND last_error_at > recent_threshold) > 5
                THEN 'WARNING: High error rate'
            ELSE 'HEALTHY'
        END as status,
        COUNT(*)::BIGINT as total_notes,
        COUNT(*) FILTER (WHERE processing_started_at < stuck_threshold AND processed_at IS NULL AND error_message IS NULL)::BIGINT as stuck_processing,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL AND last_error_at > recent_threshold)::BIGINT as recent_errors,
        (
            COUNT(*) FILTER (WHERE processing_started_at < stuck_threshold AND processed_at IS NULL AND error_message IS NULL) = 0
            AND COUNT(*) FILTER (WHERE error_message IS NOT NULL AND last_error_at > recent_threshold) <= 5
        ) as system_healthy
    FROM notes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION get_system_processing_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_system_health_stats() TO authenticated, service_role;

-- Ensure the fixed get_processing_stats function has proper permissions
GRANT EXECUTE ON FUNCTION get_processing_stats(UUID) TO authenticated, service_role; 