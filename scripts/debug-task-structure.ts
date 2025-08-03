import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function debugTaskStructure() {
  console.log('🔍 Debugging Task Data Structure...\n');

  // Create admin client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get user with notes
  const { data: user } = await adminClient
    .from('users')
    .select('id')
    .eq('email', 'andy@andykaufman.net')
    .single();

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log(`✅ Found user: ${user.id}`);

  // Get notes with analysis to inspect task structure
  const { data: notes, error } = await adminClient
    .from('notes')
    .select('id, analysis, recorded_at')
    .eq('user_id', user.id)
    .not('analysis', 'is', null)  
    .limit(3);

  if (error) {
    console.error('❌ Error fetching notes:', error);
    return;
  }

  console.log(`\n📝 Found ${notes?.length || 0} notes with analysis`);

  if (notes && notes.length > 0) {
    notes.forEach((note, index) => {
      console.log(`\n--- Note ${index + 1} (${note.id}) ---`);
      
      if (note.analysis?.tasks) {
        console.log('📋 Tasks structure:');
        
        if (note.analysis.tasks.myTasks) {
          console.log('  My Tasks:');
          note.analysis.tasks.myTasks.forEach((task: any, taskIndex: number) => {
            console.log(`    ${taskIndex + 1}. Type: ${typeof task}`);
            
            if (typeof task === 'object') {
              console.log(`❌ FOUND OBJECT TASK!`);
              console.log(`       Keys: [${Object.keys(task).join(', ')}]`);
              console.log(`       Content:`, JSON.stringify(task, null, 8));
              
              // Check if it has the problematic structure
              if (task.task || task.nextSteps || task.assignedTo) {
                console.log('🎯 This is the problematic object structure!');
              }
            } else {
              console.log(`       Content: "${task}"`);
            }
          });
        }
        
        if (note.analysis.tasks.delegatedTasks) {
          console.log('  Delegated Tasks:');
          note.analysis.tasks.delegatedTasks.forEach((task: any, taskIndex: number) => {
            console.log(`    ${taskIndex + 1}. Type: ${typeof task}`);
            
            if (typeof task === 'object') {
              console.log(`❌ FOUND OBJECT TASK!`);
              console.log(`       Keys: [${Object.keys(task).join(', ')}]`);
              console.log(`       Content:`, JSON.stringify(task, null, 8));
            } else {
              console.log(`       Content: "${task}"`);
            }
          });
        }
      } else {
        console.log('  No tasks found in this note');
      }
    });
  }

  console.log('\n💡 Solution:');
  console.log('If tasks are objects with {task, nextSteps, assignedTo}, we need to:');
  console.log('1. Extract the "task" property when rendering');
  console.log('2. Update the API aggregation to handle object tasks');
  console.log('3. Consider displaying additional task details like nextSteps');
}

debugTaskStructure().catch(console.error);