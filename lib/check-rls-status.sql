-- Check current RLS status and policies
-- Run this in Supabase SQL editor to diagnose the issue

-- 1. Check if RLS is enabled on tables
SELECT 
    schemaname,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'notes', 'project_knowledge')
ORDER BY tablename;

-- 2. List all existing policies
SELECT 
    schemaname,
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'notes', 'project_knowledge')
ORDER BY tablename, policyname;

-- 3. Specifically check notes table INSERT policy
SELECT 
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'notes' 
AND cmd = 'INSERT';

-- 4. Test if current user can insert into notes
-- Replace 'test-audio-url' with an actual URL
SELECT auth.uid() as current_user_id;

-- 5. Check if there are any notes in the table
SELECT COUNT(*) as total_notes FROM notes;

-- 6. Try a test insert (this will help identify the exact issue)
-- Uncomment and run this to test:
-- INSERT INTO notes (user_id, audio_url, recorded_at) 
-- VALUES (auth.uid(), 'test://test.mp3', NOW())
-- RETURNING id, user_id;