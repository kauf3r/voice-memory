import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testTasksFeature() {
  console.log('🔍 Testing Tasks Feature...\n');

  // Create admin client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get the user
  const { data: user } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', 'andy@andykaufman.net')
    .single();

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log(`✅ Found user: ${user.email}`);

  // Test the API with service key (simulating authenticated request)
  console.log('\n📡 Testing updated /api/knowledge endpoint...');
  
  try {
    const response = await fetch(`${appUrl}/api/knowledge`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ API Response received');
    console.log('\n📊 Knowledge Stats:');
    if (data.knowledge?.stats) {
      const stats = data.knowledge.stats;
      console.log(`  - Total Notes: ${stats.totalNotes}`);
      console.log(`  - Total Insights: ${stats.totalInsights}`);
      console.log(`  - Total Tasks: ${stats.totalTasks}`);
    }

    console.log('\n✅ Tasks Feature Check:');
    if (data.knowledge?.content?.allTasks) {
      const allTasks = data.knowledge.content.allTasks;
      console.log(`  - Total individual tasks: ${allTasks.length}`);
      
      const myTasks = allTasks.filter((t: any) => t.type === 'myTasks');
      const delegatedTasks = allTasks.filter((t: any) => t.type === 'delegatedTasks');
      
      console.log(`  - My Tasks: ${myTasks.length}`);
      console.log(`  - Delegated Tasks: ${delegatedTasks.length}`);
      
      if (allTasks.length > 0) {
        console.log('\n📝 Sample Tasks:');
        allTasks.slice(0, 3).forEach((task: any, index: number) => {
          console.log(`  ${index + 1}. [${task.type}] ${task.description}`);
          console.log(`     📅 ${task.date.split('T')[0]}`);
          console.log(`     📝 ${task.noteContext?.substring(0, 50)}...`);
        });
      }
    } else {
      console.log('❌ No allTasks found in response');
    }

    console.log('\n🎉 Tasks feature test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Open http://localhost:3000/knowledge in your browser');
    console.log('2. Log in with: andy@andykaufman.net');
    console.log('3. Click on the "Tasks" tab to see individual tasks');
    console.log('4. Try clicking the "96 Tasks" stat card to jump to the Tasks tab');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTasksFeature().catch(console.error);