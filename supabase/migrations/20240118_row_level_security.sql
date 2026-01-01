-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_knowledge ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id);

-- Notes table policies
CREATE POLICY "Users can view own notes"
    ON public.notes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
    ON public.notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
    ON public.notes
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
    ON public.notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Project knowledge policies
CREATE POLICY "Users can view own project knowledge"
    ON public.project_knowledge
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own project knowledge"
    ON public.project_knowledge
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Storage policies (to be configured in Supabase dashboard)
-- These comments show what needs to be set up:
-- 1. Create a bucket named 'audio-files'
-- 2. Set the bucket to private
-- 3. Add RLS policies:
--    - Users can upload to their own folder: auth.uid() = (storage.foldername(name))[1]
--    - Users can view their own files: auth.uid() = owner
--    - Users can delete their own files: auth.uid() = owner