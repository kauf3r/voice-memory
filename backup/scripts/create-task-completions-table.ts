import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

async function createTaskCompletionsTable() {
  console.log('🔄 Creating task_completions table using direct API calls...\n')

  try {
    // Use direct SQL execution via REST API
    const sqlStatements = [
      // Create table
      `
      CREATE TABLE IF NOT EXISTS public.task_completions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL,
        note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_by TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, task_id)
      );`,
      
      // Enable RLS
      'ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;',
      
      // Create indexes
      'CREATE INDEX IF NOT EXISTS task_completions_user_id_idx ON public.task_completions(user_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_task_id_idx ON public.task_completions(task_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_note_id_idx ON public.task_completions(note_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_completed_at_idx ON public.task_completions(completed_at DESC);',
      
      // Create policies
      `CREATE POLICY IF NOT EXISTS "Users can view their own task completions" ON public.task_completions FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can insert their own task completions" ON public.task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can update their own task completions" ON public.task_completions FOR UPDATE USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can delete their own task completions" ON public.task_completions FOR DELETE USING (auth.uid() = user_id);`
    ]

    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i].trim()
      console.log(`📝 Executing statement ${i + 1}/${sqlStatements.length}...`)
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ query: statement })
        })

        if (!response.ok) {
          const error = await response.text()
          console.log(`⚠️ Statement ${i + 1} warning:`, error)
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (error) {
        console.log(`⚠️ Statement ${i + 1} error:`, error)
      }
    }

    // Try alternative approach - direct table creation using supabase client
    console.log('\n🔄 Attempting alternative table creation...')
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Test if we can create the table by trying to insert a dummy record and see what error we get
    console.log('🧪 Testing table existence by querying...')
    const { data, error } = await adminClient
      .from('task_completions')
      .select('id')
      .limit(1)

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Table does not exist and cannot be created via Supabase client')
        console.log('📖 Manual SQL execution required in Supabase dashboard')
        
        console.log('\n📋 Please execute this SQL in your Supabase SQL Editor:')
        console.log('=' .repeat(60))
        console.log(`
-- Create task_completions table
CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS task_completions_user_id_idx ON public.task_completions(user_id);
CREATE INDEX IF NOT EXISTS task_completions_task_id_idx ON public.task_completions(task_id);
CREATE INDEX IF NOT EXISTS task_completions_note_id_idx ON public.task_completions(note_id);
CREATE INDEX IF NOT EXISTS task_completions_completed_at_idx ON public.task_completions(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own task completions" ON public.task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own task completions" ON public.task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own task completions" ON public.task_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own task completions" ON public.task_completions FOR DELETE USING (auth.uid() = user_id);
        `)
        console.log('=' .repeat(60))
        
        // For development, let's continue with the assumption the table will be created
        console.log('\n⚠️ Continuing with development assuming table will be created manually')
        
      } else {
        console.log('❌ Unexpected error:', error)
      }
    } else {
      console.log('✅ Table already exists or was created successfully!')
      console.log(`📊 Found ${data?.length || 0} existing completion records`)
    }

  } catch (error) {
    console.error('❌ Table creation failed:', error)
    
    console.log('\n📖 Please create the table manually in Supabase:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Run the SQL from above')
  }
}

createTaskCompletionsTable().catch(console.error)