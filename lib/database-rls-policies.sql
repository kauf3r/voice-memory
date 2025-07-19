-- Row Level Security (RLS) Policies for Voice Memory
-- Run these commands in your Supabase SQL editor

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_knowledge ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Notes table policies
-- Users can view their own notes
CREATE POLICY "Users can view own notes" ON notes
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own notes
CREATE POLICY "Users can insert own notes" ON notes
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own notes
CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE USING (user_id = auth.uid());

-- Project knowledge table policies
-- Users can view their own project knowledge
CREATE POLICY "Users can view own project knowledge" ON project_knowledge
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own project knowledge
CREATE POLICY "Users can insert own project knowledge" ON project_knowledge
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own project knowledge
CREATE POLICY "Users can update own project knowledge" ON project_knowledge
    FOR UPDATE USING (user_id = auth.uid());

-- Storage policies for audio files bucket
-- Note: These need to be set in the Supabase dashboard under Storage > Policies
-- Users can upload files to their own folder: user_id/*
-- Users can view/download their own files: user_id/*
-- Users can delete their own files: user_id/*

-- Helper function to check if a user owns a note
CREATE OR REPLACE FUNCTION user_owns_note(note_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM notes 
        WHERE id = note_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Service role function for admin operations
-- This allows service role key to bypass RLS for batch processing
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the current role is service_role
    RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
END;
$$ LANGUAGE plpgsql;

-- Example of using service role check in a policy
-- CREATE POLICY "Service role can do anything" ON notes
--     FOR ALL USING (is_service_role());

-- Verify policies are working
-- Run these queries to check:
-- SELECT * FROM notes; -- Should only show notes for logged-in user
-- INSERT INTO notes (user_id, audio_url) VALUES (auth.uid(), 'test.mp3'); -- Should work
-- INSERT INTO notes (user_id, audio_url) VALUES ('other-user-id', 'test.mp3'); -- Should fail