-- Performance Monitoring and Optimization Tables
-- Add comprehensive tracking for audio processing optimization

-- Processing metrics table for detailed performance tracking
CREATE TABLE IF NOT EXISTS processing_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Timing metrics
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  transcription_time_ms INTEGER DEFAULT 0,
  analysis_time_ms INTEGER DEFAULT 0,
  optimization_time_ms INTEGER DEFAULT 0,
  
  -- File metrics
  file_size_bytes BIGINT NOT NULL,
  original_format TEXT NOT NULL,
  optimized_format TEXT,
  compression_ratio DECIMAL(4,2) DEFAULT 1.0,
  
  -- Processing configuration
  whisper_model TEXT NOT NULL DEFAULT 'whisper-1',
  was_chunked BOOLEAN DEFAULT FALSE,
  chunk_count INTEGER,
  from_cache BOOLEAN DEFAULT FALSE,
  
  -- Cost tracking
  estimated_cost DECIMAL(8,4) DEFAULT 0,
  actual_cost DECIMAL(8,4),
  
  -- Quality and error tracking
  error_occurred BOOLEAN DEFAULT FALSE,
  error_category TEXT,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_processing_metrics_user_id (user_id),
  INDEX idx_processing_metrics_created_at (created_at),
  INDEX idx_processing_metrics_whisper_model (whisper_model),
  INDEX idx_processing_metrics_error (error_occurred, error_category)
);

-- Audio optimization cache table
CREATE TABLE IF NOT EXISTS audio_optimization_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_hash TEXT NOT NULL UNIQUE, -- Hash of original file content
  user_id UUID NOT NULL,
  
  -- Original file info
  original_size BIGINT NOT NULL,
  original_format TEXT NOT NULL,
  
  -- Optimization results
  optimized_size BIGINT NOT NULL,
  compression_ratio DECIMAL(4,2) NOT NULL,
  recommended_model TEXT NOT NULL,
  should_chunk BOOLEAN NOT NULL,
  chunk_strategy JSONB,
  quality_metrics JSONB NOT NULL,
  
  -- Cache metadata
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Indexes
  INDEX idx_audio_cache_file_hash (file_hash),
  INDEX idx_audio_cache_user_id (user_id),
  INDEX idx_audio_cache_expires_at (expires_at)
);

-- Transcription cache table
CREATE TABLE IF NOT EXISTS transcription_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE, -- Hash of file + model + options
  
  -- Cache content
  transcription_text TEXT NOT NULL,
  transcription_metadata JSONB,
  whisper_model TEXT NOT NULL,
  processing_options JSONB,
  
  -- Cache statistics
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- File info for reference
  original_filename TEXT,
  file_size_bytes BIGINT,
  
  -- Indexes
  INDEX idx_transcription_cache_content_hash (content_hash),
  INDEX idx_transcription_cache_model (whisper_model),
  INDEX idx_transcription_cache_expires_at (expires_at)
);

-- Cost tracking table for budget management
CREATE TABLE IF NOT EXISTS daily_cost_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  user_id UUID,
  
  -- Cost breakdown
  total_cost DECIMAL(8,4) NOT NULL DEFAULT 0,
  whisper_cost DECIMAL(8,4) NOT NULL DEFAULT 0,
  gpt_cost DECIMAL(8,4) NOT NULL DEFAULT 0,
  storage_cost DECIMAL(8,4) NOT NULL DEFAULT 0,
  
  -- Usage statistics
  request_count INTEGER NOT NULL DEFAULT 0,
  audio_minutes DECIMAL(8,2) NOT NULL DEFAULT 0,
  cache_hit_rate DECIMAL(4,2) NOT NULL DEFAULT 0,
  error_rate DECIMAL(4,2) NOT NULL DEFAULT 0,
  
  -- Model usage breakdown
  model_usage JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(date, user_id),
  
  -- Indexes
  INDEX idx_daily_cost_date (date),
  INDEX idx_daily_cost_user_id (user_id),
  INDEX idx_daily_cost_total_cost (total_cost)
);

-- Performance benchmarks for optimization
CREATE TABLE IF NOT EXISTS performance_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Benchmark configuration
  file_size_range TEXT NOT NULL, -- e.g., '0-5MB', '5-15MB', '15MB+'
  audio_format TEXT NOT NULL,
  whisper_model TEXT NOT NULL,
  
  -- Performance metrics
  avg_processing_time_ms INTEGER NOT NULL,
  avg_cost DECIMAL(8,4) NOT NULL,
  success_rate DECIMAL(4,2) NOT NULL,
  quality_score INTEGER,
  
  -- Optimization recommendations
  recommended_chunk_size INTEGER,
  recommended_preprocessing JSONB,
  
  -- Sample size and confidence
  sample_count INTEGER NOT NULL,
  confidence_level DECIMAL(4,2) NOT NULL,
  
  -- Metadata
  benchmark_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(file_size_range, audio_format, whisper_model, benchmark_date),
  
  -- Indexes
  INDEX idx_benchmarks_format_model (audio_format, whisper_model),
  INDEX idx_benchmarks_date (benchmark_date)
);

-- Functions for cache management and cleanup

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  cleanup_count INTEGER := 0;
BEGIN
  -- Clean audio optimization cache
  DELETE FROM audio_optimization_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Clean transcription cache
  DELETE FROM transcription_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS cleanup_count = cleanup_count + ROW_COUNT;
  
  -- Clean old processing metrics (keep 90 days)
  DELETE FROM processing_metrics WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS cleanup_count = cleanup_count + ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$ language plpgsql SECURITY DEFINER;

-- Function to update cache hit counts
CREATE OR REPLACE FUNCTION update_cache_hit(cache_table TEXT, cache_id UUID)
RETURNS VOID AS $$
BEGIN
  IF cache_table = 'audio_optimization_cache' THEN
    UPDATE audio_optimization_cache 
    SET hit_count = hit_count + 1, last_used_at = NOW()
    WHERE id = cache_id;
  ELSIF cache_table = 'transcription_cache' THEN
    UPDATE transcription_cache 
    SET hit_count = hit_count + 1, last_used_at = NOW()
    WHERE id = cache_id;
  END IF;
END;
$$ language plpgsql SECURITY DEFINER;

-- Function to get processing insights
CREATE OR REPLACE FUNCTION get_processing_insights(
  p_user_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days || ' days')::INTERVAL;
  
  WITH metrics AS (
    SELECT 
      COUNT(*) as total_requests,
      AVG(total_duration_ms) as avg_processing_time,
      AVG(actual_cost) as avg_cost,
      SUM(CASE WHEN error_occurred THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) as error_rate,
      SUM(CASE WHEN from_cache THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) as cache_hit_rate,
      AVG(quality_score) as avg_quality_score
    FROM processing_metrics 
    WHERE created_at >= start_date 
      AND (p_user_id IS NULL OR user_id = p_user_id)
  )
  SELECT json_build_object(
    'total_requests', total_requests,
    'avg_processing_time_ms', COALESCE(avg_processing_time, 0),
    'avg_cost', COALESCE(avg_cost, 0),
    'error_rate', COALESCE(error_rate, 0),
    'cache_hit_rate', COALESCE(cache_hit_rate, 0),
    'quality_score', COALESCE(avg_quality_score, 0),
    'period_days', p_days
  ) INTO result FROM metrics;
  
  RETURN result;
END;
$$ language plpgsql SECURITY DEFINER;

-- Create scheduled cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');

-- Grant permissions for the service role
GRANT SELECT, INSERT, UPDATE, DELETE ON processing_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON audio_optimization_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON transcription_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_cost_summary TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_benchmarks TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_cache() TO service_role;
GRANT EXECUTE ON FUNCTION update_cache_hit(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_processing_insights(UUID, INTEGER) TO service_role;

-- Comments for documentation
COMMENT ON TABLE processing_metrics IS 'Detailed metrics for each audio processing job';
COMMENT ON TABLE audio_optimization_cache IS 'Cache for audio optimization results to avoid reprocessing';
COMMENT ON TABLE transcription_cache IS 'Cache for transcription results to reduce API costs';
COMMENT ON TABLE daily_cost_summary IS 'Daily aggregated cost and usage statistics';
COMMENT ON TABLE performance_benchmarks IS 'Performance benchmarks for different file types and configurations';