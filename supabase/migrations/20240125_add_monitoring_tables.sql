-- Add production monitoring tables for error tracking and performance metrics

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  stack TEXT,
  user_id UUID REFERENCES users(id),
  route TEXT NOT NULL,
  component TEXT,
  browser TEXT,
  device TEXT,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_route ON error_logs(route);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_id ON error_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_timestamp ON performance_metrics(metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_timestamp ON performance_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);

-- Row Level Security (RLS) policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

-- Admin users can see all monitoring data
CREATE POLICY "Admin users can view all error logs" ON error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can view all performance metrics" ON performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can view all performance alerts" ON performance_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Service role can insert monitoring data
CREATE POLICY "Service role can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can insert performance alerts" ON performance_alerts
  FOR INSERT WITH CHECK (true);

-- Users can view their own error logs (for debugging)
CREATE POLICY "Users can view own error logs" ON error_logs
  FOR SELECT USING (user_id = auth.uid());

-- Add monitoring configuration table
CREATE TABLE IF NOT EXISTS monitoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default monitoring configuration
INSERT INTO monitoring_config (key, value, description) VALUES
  ('error_retention_days', '30', 'Number of days to retain error logs'),
  ('metric_retention_days', '90', 'Number of days to retain performance metrics'),
  ('alert_thresholds', '{
    "FCP": 1800,
    "LCP": 2500,
    "TTI": 3800,
    "CLS": 0.1,
    "FID": 100,
    "api_response_time": 5000,
    "transcription_time": 30000,
    "analysis_time": 10000
  }', 'Performance alert thresholds in milliseconds'),
  ('sampling_rate', '0.1', 'Production monitoring sampling rate (0.0 to 1.0)'),
  ('enable_alerts', 'true', 'Enable performance alerts')
ON CONFLICT (key) DO NOTHING;

-- Admin RLS for monitoring config
ALTER TABLE monitoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage monitoring config" ON monitoring_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create a function to clean up old monitoring data
CREATE OR REPLACE FUNCTION cleanup_monitoring_data()
RETURNS void AS $$
BEGIN
  -- Delete old error logs
  DELETE FROM error_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete old performance metrics
  DELETE FROM performance_metrics 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete resolved performance alerts older than 7 days
  DELETE FROM performance_alerts 
  WHERE resolved = TRUE 
  AND resolved_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;