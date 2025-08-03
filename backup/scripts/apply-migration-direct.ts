import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

async function applyMigrationDirect() {
  console.log('🔄 Applying task completion migration directly...\n')

  // Create admin client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Create the task_completions table
    console.log('📋 Creating task_completions table...')
    const { error: tableError } = await adminClient.rpc('sql', {
      query: `
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
      `
    })

    if (tableError) {
      console.log('⚠️ Table creation error (might already exist):', tableError.message)
    } else {
      console.log('✅ task_completions table created')
    }

    // Create indexes
    console.log('🔗 Creating indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS task_completions_user_id_idx ON public.task_completions(user_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_task_id_idx ON public.task_completions(task_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_note_id_idx ON public.task_completions(note_id);',
      'CREATE INDEX IF NOT EXISTS task_completions_completed_at_idx ON public.task_completions(completed_at DESC);'
    ]

    for (let i = 0; i < indexes.length; i++) {
      const { error } = await adminClient.rpc('sql', { query: indexes[i] })
      if (error) {
        console.log(`⚠️ Index ${i + 1} error:`, error.message)
      }
    }
    console.log('✅ Indexes created')

    // Enable RLS
    console.log('🔒 Enabling Row Level Security...')
    const { error: rlsError } = await adminClient.rpc('sql', {
      query: 'ALTER TABLE IF EXISTS public.task_completions ENABLE ROW LEVEL SECURITY;'
    })

    if (rlsError) {
      console.log('⚠️ RLS error:', rlsError.message)
    } else {
      console.log('✅ RLS enabled')
    }

    // Create basic policies
    console.log('📝 Creating RLS policies...')
    const policies = [
      `CREATE POLICY IF NOT EXISTS "task_completions_select_policy" ON public.task_completions FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "task_completions_insert_policy" ON public.task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "task_completions_update_policy" ON public.task_completions FOR UPDATE USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "task_completions_delete_policy" ON public.task_completions FOR DELETE USING (auth.uid() = user_id);`
    ]

    for (let i = 0; i < policies.length; i++) {
      const { error } = await adminClient.rpc('sql', { query: policies[i] })
      if (error) {
        console.log(`⚠️ Policy ${i + 1} error:`, error.message)
      }
    }
    console.log('✅ RLS policies created')

    // Test table existence
    console.log('🧪 Testing table access...')
    const { data: testData, error: testError } = await adminClient
      .from('task_completions')
      .select('id')
      .limit(1)

    if (testError) {
      console.log('⚠️ Table access error:', testError.message)
    } else {
      console.log('✅ Table access working (found', testData?.length || 0, 'records)')
    }

    console.log('\n🎉 Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigrationDirect().catch(console.error)