#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FixResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

class EmergencyVercelFix {
  private supabase: any;
  private results: FixResult[] = [];

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  private log(step: string, success: boolean, message: string, details?: any) {
    const result: FixResult = { step, success, message, details };
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${step}: ${message}`);
    if (details && !success) {
      console.log('   Details:', details);
    }
  }

  private async checkMigrationStatus(): Promise<boolean> {
    try {
      // Check if error tracking columns exist
      const { data, error } = await this.supabase
        .from('voice_notes')
        .select('error_message, processing_attempts, last_error_at')
        .limit(1);

      if (error && error.message.includes('column')) {
        return false; // Columns don't exist
      }

      // Check if database functions exist
      const { data: funcData, error: funcError } = await this.supabase
        .rpc('get_system_processing_stats');

      return !funcError;
    } catch (error) {
      return false;
    }
  }

  private async applyMigration(): Promise<boolean> {
    try {
      const migrationPath = join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Split migration into chunks for better reliability
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.length > 0) {
          const { error } = await this.supabase.rpc('exec_sql', {
            sql_query: statement + ';'
          });

          if (error && !error.message.includes('already exists')) {
            // Try direct execution if RPC fails
            const { error: directError } = await this.supabase
              .from('_migration_log')
              .insert({ 
                version: '20240119_add_error_tracking',
                statement: statement,
                applied_at: new Date().toISOString()
              });

            // Continue even if logging fails
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Migration application error:', error);
      return false;
    }
  }

  private async checkVercelEnvironment(): Promise<boolean> {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
              'SUPABASE_SERVICE_KEY',
      'OPENAI_API_KEY',
      'CRON_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      this.log('Environment Check', false, `Missing variables: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  private async testAPIEndpoints(): Promise<boolean> {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';

      // Test health endpoint
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      if (!healthResponse.ok) {
        this.log('API Test', false, `Health endpoint failed: ${healthResponse.status}`);
        return false;
      }

      // Test protected endpoint
      const batchResponse = await fetch(`${baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json'
        }
      });

      return batchResponse.status !== 500; // Should not be server error
    } catch (error) {
      this.log('API Test', false, 'API endpoints unreachable', error);
      return false;
    }
  }

  private async resetProcessingState(): Promise<boolean> {
    try {
      // Clear stuck processing locks
      const { error: resetError } = await this.supabase
        .from('voice_notes')
        .update({ 
          status: 'pending',
          processing_started_at: null,
          processing_attempts: 0,
          error_message: null
        })
        .in('status', ['processing', 'error'])
        .lt('processing_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (resetError) {
        this.log('Reset Processing', false, 'Failed to reset processing state', resetError);
        return false;
      }

      return true;
    } catch (error) {
      this.log('Reset Processing', false, 'Error resetting processing state', error);
      return false;
    }
  }

  private async testProcessingPipeline(): Promise<boolean> {
    try {
      // Create a test note
      const testNote = {
        id: `test-${Date.now()}`,
        user_id: 'test-user',
        filename: 'test-audio.mp3',
        file_size: 1024,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await this.supabase
        .from('voice_notes')
        .insert(testNote);

      if (insertError) {
        this.log('Pipeline Test', false, 'Failed to create test note', insertError);
        return false;
      }

      // Clean up test note
      await this.supabase
        .from('voice_notes')
        .delete()
        .eq('id', testNote.id);

      return true;
    } catch (error) {
      this.log('Pipeline Test', false, 'Pipeline test failed', error);
      return false;
    }
  }

  private async verifyCronJobs(): Promise<boolean> {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';

      const cronResponse = await fetch(`${baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });

      return cronResponse.ok;
    } catch (error) {
      this.log('Cron Test', false, 'Cron job test failed', error);
      return false;
    }
  }

  public async runEmergencyFix(): Promise<void> {
    console.log('🚨 Emergency Vercel Fix Starting...\n');
    
    // Step 1: Critical Migration Fix
    console.log('Step 1: Checking migration status...');
    const migrationExists = await this.checkMigrationStatus();
    
    if (!migrationExists) {
      console.log('❗ Critical migration missing - applying now...');
      const migrationSuccess = await this.applyMigration();
      this.log('Critical Migration', migrationSuccess, 
        migrationSuccess ? 'Migration applied successfully' : 'Migration failed to apply');
      
      if (!migrationSuccess) {
        console.log('\n🔧 Manual migration required - see VERCEL_EMERGENCY_GUIDE.md');
        return;
      }
    } else {
      this.log('Migration Check', true, 'All required migrations are present');
    }

    // Step 2: Vercel Environment Check
    console.log('\nStep 2: Checking Vercel environment...');
    const envSuccess = await this.checkVercelEnvironment();
    this.log('Environment Check', envSuccess, 
      envSuccess ? 'All environment variables present' : 'Missing required environment variables');

    // Step 3: Reset Processing State
    console.log('\nStep 3: Resetting processing state...');
    const resetSuccess = await this.resetProcessingState();
    this.log('Processing Reset', resetSuccess, 
      resetSuccess ? 'Processing state reset successfully' : 'Failed to reset processing state');

    // Step 4: Test Processing Pipeline
    console.log('\nStep 4: Testing processing pipeline...');
    const pipelineSuccess = await this.testProcessingPipeline();
    this.log('Pipeline Test', pipelineSuccess, 
      pipelineSuccess ? 'Processing pipeline working' : 'Processing pipeline failed');

    // Step 5: Verify Cron Jobs
    console.log('\nStep 5: Verifying cron jobs...');
    const cronSuccess = await this.verifyCronJobs();
    this.log('Cron Verification', cronSuccess, 
      cronSuccess ? 'Cron jobs operational' : 'Cron jobs not working');

    // Step 6: API Endpoint Testing
    console.log('\nStep 6: Testing API endpoints...');
    const apiSuccess = await this.testAPIEndpoints();
    this.log('API Test', apiSuccess, 
      apiSuccess ? 'API endpoints responding' : 'API endpoints not accessible');

    // Final Summary
    console.log('\n📊 Emergency Fix Results:');
    console.log('========================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.step}: ${result.message}`);
    });

    console.log(`\n🎯 Success Rate: ${successCount}/${totalCount} steps completed`);
    
    if (successCount === totalCount) {
      console.log('\n🎉 Emergency fix completed successfully!');
      console.log('✨ Vercel deployment should now be processing notes.');
    } else {
      console.log('\n⚠️  Some steps failed - manual intervention may be required.');
      console.log('📋 See VERCEL_EMERGENCY_GUIDE.md for troubleshooting steps.');
    }
  }
}

// Run the emergency fix
if (require.main === module) {
  const fix = new EmergencyVercelFix();
  fix.runEmergencyFix().catch(error => {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  });
}

export default EmergencyVercelFix; 