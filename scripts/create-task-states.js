const { createClient } = require('@supabase/supabase-js');

async function createTaskStatesTable() {
  console.log('🔧 Creating task_states and task_edit_history tables...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing required environment variables');
  }
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // First, let's test if the tables already exist
  console.log('🔍 Checking if task_states table exists...');
  try {
    const { data, error } = await supabase.from('task_states').select('id').limit(1);
    
    if (!error) {
      console.log('✅ task_states table already exists and is accessible');
      return;
    } else if (error.code === '42P01') {
      console.log('❌ task_states table does not exist, need to create it');
    } else {
      console.error('❌ Unexpected error checking table:', error.message);
      return;
    }
  } catch (err) {
    console.log('❌ Table check failed:', err.message);
  }
  
  // Since we can't execute DDL directly through the client, let's provide the SQL
  console.log(`
📋 Please execute the following SQL in your Supabase SQL Editor:

-- Create task_states table
CREATE TABLE IF NOT EXISTS public.task_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    note_id UUID NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    pin_order INTEGER DEFAULT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    completed_by TEXT DEFAULT NULL,
    completion_notes TEXT DEFAULT NULL,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS task_states_user_id_idx ON public.task_states(user_id);
CREATE INDEX IF NOT EXISTS task_states_task_id_idx ON public.task_states(task_id);
CREATE INDEX IF NOT EXISTS task_states_note_id_idx ON public.task_states(note_id);
CREATE INDEX IF NOT EXISTS task_states_completed_idx ON public.task_states(completed) WHERE completed = true;
CREATE INDEX IF NOT EXISTS task_states_pinned_idx ON public.task_states(pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS task_states_archived_idx ON public.task_states(archived) WHERE archived = true;

-- Enable Row Level Security
ALTER TABLE public.task_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_states
CREATE POLICY "Users can view their own task states"
    ON public.task_states FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task states"
    ON public.task_states FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task states"
    ON public.task_states FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task states"
    ON public.task_states FOR DELETE
    USING (auth.uid() = user_id);

-- Create task_edit_history table
CREATE TABLE IF NOT EXISTS public.task_edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    note_id UUID NOT NULL,
    task_state_id UUID REFERENCES public.task_states(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edit_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for task_edit_history
CREATE INDEX IF NOT EXISTS task_edit_history_user_id_idx ON public.task_edit_history(user_id);
CREATE INDEX IF NOT EXISTS task_edit_history_task_id_idx ON public.task_edit_history(task_id);
CREATE INDEX IF NOT EXISTS task_edit_history_note_id_idx ON public.task_edit_history(note_id);
CREATE INDEX IF NOT EXISTS task_edit_history_created_at_idx ON public.task_edit_history(created_at DESC);

-- Enable Row Level Security for task_edit_history
ALTER TABLE public.task_edit_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_edit_history
CREATE POLICY "Users can view their own task edit history"
    ON public.task_edit_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task edit history"
    ON public.task_edit_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.task_states TO authenticated;
GRANT ALL ON public.task_edit_history TO authenticated;

-- Success message
SELECT 'Task states and edit history tables created successfully!' as message;

  `);
  
  console.log('ℹ️  Copy and paste the above SQL into your Supabase SQL Editor to create the tables.');
  console.log('🔗 Go to: https://supabase.com/dashboard/project/vbjszugsvrqxosbtffqw/sql/new');
}

// Run the script
createTaskStatesTable().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});