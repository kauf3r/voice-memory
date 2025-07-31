-- Row Level Security (RLS) Policies for Voice Memory
-- This version checks if policies exist before creating them
-- Run these commands in your Supabase SQL editor

-- Enable RLS on all tables (safe to run multiple times)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_knowledge ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (uncomment if you need to recreate)
-- DROP POLICY IF EXISTS "Users can view own profile" ON users;
-- DROP POLICY IF EXISTS "Users can update own profile" ON users;
-- DROP POLICY IF EXISTS "Users can view own notes" ON notes;
-- DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
-- DROP POLICY IF EXISTS "Users can update own notes" ON notes;
-- DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
-- DROP POLICY IF EXISTS "Users can view own project knowledge" ON project_knowledge;
-- DROP POLICY IF EXISTS "Users can insert own project knowledge" ON project_knowledge;
-- DROP POLICY IF EXISTS "Users can update own project knowledge" ON project_knowledge;

-- Create policies only if they don't exist
DO $$
BEGIN
    -- Users table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON users
            FOR SELECT USING (id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON users
            FOR UPDATE USING (id = auth.uid());
    END IF;

    -- Notes table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can view own notes') THEN
        CREATE POLICY "Users can view own notes" ON notes
            FOR SELECT USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can insert own notes') THEN
        CREATE POLICY "Users can insert own notes" ON notes
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can update own notes') THEN
        CREATE POLICY "Users can update own notes" ON notes
            FOR UPDATE USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can delete own notes') THEN
        CREATE POLICY "Users can delete own notes" ON notes
            FOR DELETE USING (user_id = auth.uid());
    END IF;

    -- Project knowledge table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_knowledge' AND policyname = 'Users can view own project knowledge') THEN
        CREATE POLICY "Users can view own project knowledge" ON project_knowledge
            FOR SELECT USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_knowledge' AND policyname = 'Users can insert own project knowledge') THEN
        CREATE POLICY "Users can insert own project knowledge" ON project_knowledge
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_knowledge' AND policyname = 'Users can update own project knowledge') THEN
        CREATE POLICY "Users can update own project knowledge" ON project_knowledge
            FOR UPDATE USING (user_id = auth.uid());
    END IF;
END $$;

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'notes', 'project_knowledge', 'api_usage', 'processing_attempts')
ORDER BY tablename, policyname;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'notes', 'project_knowledge', 'api_usage', 'processing_attempts');

-- Test query to verify notes table policies
-- This should return 0 if policies are working correctly
SELECT COUNT(*) as should_be_zero 
FROM notes 
WHERE user_id != auth.uid();