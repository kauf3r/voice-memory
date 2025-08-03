import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check what tables exist in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      
      // Try an alternative approach using raw SQL
      console.log('Trying alternative approach...');
      const { data: altTables, error: altError } = await supabase.rpc('get_tables');
      
      if (altError) {
        console.error('Alternative approach failed:', altError);
        
        // Try checking specific table we expect
        console.log('Checking if voice_notes table exists by trying to query it...');
        const { data, error } = await supabase
          .from('voice_notes')
          .select('*')
          .limit(1);
          
        if (error) {
          console.error('voice_notes table query error:', error);
          
          // Check if it might be called something else
          console.log('\nTrying common table name variations...');
          const variations = ['voicenotes', 'audio_notes', 'recordings', 'notes', 'uploads'];
          
          for (const variation of variations) {
            const { data, error } = await supabase
              .from(variation)
              .select('*')
              .limit(1);
              
            if (!error) {
              console.log(`✅ Found table: ${variation}`);
              console.log('Sample data:', data?.[0] || 'No data');
            } else if (error.code !== '42P01') {
              console.log(`❓ Table ${variation} exists but has access issues:`, error.message);
            }
          }
        } else {
          console.log('✅ voice_notes table exists! Sample data:', data?.[0] || 'No data');
        }
      } else {
        console.log('Tables found:', altTables);
      }
      
      return;
    }

    if (tables && tables.length > 0) {
      console.log('📋 Tables in public schema:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    } else {
      console.log('No tables found in public schema');
    }

    // If voice_notes exists, show its structure
    if (tables?.some(t => t.table_name === 'voice_notes')) {
      console.log('\n🔍 voice_notes table structure:');
      
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', 'voice_notes')
        .order('ordinal_position');

      if (columnsError) {
        console.error('Error fetching columns:', columnsError);
      } else if (columns) {
        columns.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
        });
      }

      // Show sample data
      console.log('\n📊 Sample data from voice_notes:');
      const { data: samples, error: samplesError } = await supabase
        .from('voice_notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (samplesError) {
        console.error('Error fetching samples:', samplesError);
      } else if (samples && samples.length > 0) {
        samples.forEach((sample, index) => {
          console.log(`\n  Sample ${index + 1}:`);
          Object.entries(sample).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 50 
              ? value.substring(0, 50) + '...' 
              : value;
            console.log(`    ${key}: ${displayValue}`);
          });
        });
      } else {
        console.log('  No data found');
      }
    }

  } catch (error) {
    console.error('Error during schema check:', error);
  }
}

// Run the check
checkDatabaseSchema().then(() => {
  console.log('\n✅ Schema check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});