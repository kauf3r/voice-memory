import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simpleCheck() {
  console.log('🔍 Simple database check...\n');

  // Try common table names one by one
  const tableNames = ['voice_notes', 'voicenotes', 'audio_notes', 'notes', 'recordings'];
  
  for (const tableName of tableNames) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (!error) {
        console.log(`✅ Found table: ${tableName}`);
        if (data && data.length > 0) {
          console.log('Columns:', Object.keys(data[0]).join(', '));
          console.log('Sample record ID:', data[0].id || 'No ID field');
        } else {
          console.log('Table exists but is empty');
        }
        
        // Get count
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
          
        if (!countError) {
          console.log(`Total records: ${count}`);
        }
        
        break; // Found the table, stop checking
      } else if (error.code === '42P01') {
        console.log(`❌ Table ${tableName} does not exist`);
      } else {
        console.log(`❓ Table ${tableName} - Error: ${error.message}`);
      }
    } catch (err) {
      console.log(`❓ Table ${tableName} - Exception:`, err);
    }
  }
}

simpleCheck().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});