-- Migration for quota management tables
-- Run these commands in your Supabase SQL editor

-- Table for tracking API token usage
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table for tracking processing attempts
CREATE TABLE IF NOT EXISTS processing_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attempted_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT NULL, -- NULL = in progress, TRUE = success, FALSE = failed
    error_message TEXT,
    tokens_used INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_processing_attempts_user_time ON processing_attempts(user_id, attempted_at);

-- RLS policies for quota tables
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own quota data
CREATE POLICY "Users can view own api usage" ON api_usage
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own api usage" ON api_usage
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own api usage" ON api_usage
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own processing attempts" ON processing_attempts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own processing attempts" ON processing_attempts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for api_usage table
CREATE TRIGGER update_api_usage_updated_at
    BEFORE UPDATE ON api_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to upsert token usage (increment existing or create new)
CREATE OR REPLACE FUNCTION upsert_token_usage(
    p_user_id UUID,
    p_date DATE,
    p_tokens INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO api_usage (user_id, date, tokens_used)
    VALUES (p_user_id, p_date, p_tokens)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        tokens_used = api_usage.tokens_used + p_tokens,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old processing attempts (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_processing_attempts()
RETURNS VOID AS $$
BEGIN
    DELETE FROM processing_attempts 
    WHERE attempted_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old api usage (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS VOID AS $$
BEGIN
    DELETE FROM api_usage 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;