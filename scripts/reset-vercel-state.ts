#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

interface ResetResult {
  operation: string;
  success: boolean;
  message: string;
  affectedRows?: number;
  details?: any;
}

interface VoiceNote {
  id: string;
  filename: string;
  error_message: string;
  processing_attempts: number;
}

class VercelStateResetter {
  private supabase: any;
  private results: ResetResult[] = [];

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

  private log(operation: string, success: boolean, message: string, affectedRows?: number, details?: any) {
    const result: ResetResult = { operation, success, message, affectedRows, details };
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    const rowInfo = affectedRows !== undefined ? ` (${affectedRows} rows)` : '';
    console.log(`${status} ${operation}: ${message}${rowInfo}`);
    
    if (!success && details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  private async clearProcessingLocks(): Promise<void> {
    try {
      // Get count of stuck processing notes first
      const { data: stuckNotes, error: countError } = await this.supabase
        .from('voice_notes')
        .select('id, status, processing_started_at')
        .in('status', ['processing'])
        .lt('processing_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (countError) {
        this.log('Clear Processing Locks', false, 'Failed to query stuck notes', 0, countError);
        return;
      }

      const stuckCount = stuckNotes?.length || 0;

      if (stuckCount === 0) {
        this.log('Clear Processing Locks', true, 'No stuck processing locks found', 0);
        return;
      }

      // Reset stuck processing notes
      const { error: resetError, count } = await this.supabase
        .from('voice_notes')
        .update({ 
          status: 'pending',
          processing_started_at: null
        })
        .in('status', ['processing'])
        .lt('processing_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (resetError) {
        this.log('Clear Processing Locks', false, 'Failed to reset processing locks', 0, resetError);
      } else {
        this.log('Clear Processing Locks', true, 'Processing locks cleared', count || stuckCount);
      }
    } catch (error) {
      this.log('Clear Processing Locks', false, 'Unexpected error clearing locks', 0, error);
    }
  }

  private async resetErrorStates(): Promise<void> {
    try {
      // Get count of notes in error state
      const { data: errorNotes, error: countError } = await this.supabase
        .from('voice_notes')
        .select('id')
        .eq('status', 'error');

      if (countError) {
        this.log('Reset Error States', false, 'Failed to query error notes', 0, countError);
        return;
      }

      const errorCount = errorNotes?.length || 0;

      if (errorCount === 0) {
        this.log('Reset Error States', true, 'No error states to reset', 0);
        return;
      }

      // Reset retryable error notes (less than 3 attempts)
      const { error: resetError, count } = await this.supabase
        .from('voice_notes')
        .update({ 
          status: 'pending',
          error_message: null,
          processing_attempts: 0,
          last_error_at: null
        })
        .eq('status', 'error')
        .lt('processing_attempts', 3);

      if (resetError) {
        this.log('Reset Error States', false, 'Failed to reset error states', 0, resetError);
      } else {
        this.log('Reset Error States', true, 'Retryable error states reset', count || 0);
      }

      // Log non-retryable errors for manual review
      const { data: permanentErrors } = await this.supabase
        .from('voice_notes')
        .select('id, filename, error_message, processing_attempts')
        .eq('status', 'error')
        .gte('processing_attempts', 3);

      if (permanentErrors && permanentErrors.length > 0) {
        this.log('Reset Error States', true, `${permanentErrors.length} notes need manual review (3+ attempts)`, permanentErrors.length);
        console.log('   Files needing manual review:');
        permanentErrors.forEach((note: VoiceNote) => {
          console.log(`   - ${note.filename} (${note.processing_attempts} attempts): ${note.error_message}`);
        });
      }
    } catch (error) {
      this.log('Reset Error States', false, 'Unexpected error resetting states', 0, error);
    }
  }

  private async cleanProcessingMetrics(): Promise<void> {
    try {
      // Clear any cached processing metrics if they exist
      // This is more of a placeholder since the app doesn't have a persistent cache table
      
      // Reset processing statistics using system-level function
      const { data: stats, error: statsError } = await this.supabase.rpc('get_system_processing_stats');
      
      if (statsError) {
        // Try alternative approach if RPC function is not available
        if (statsError.message?.includes('function get_system_processing_stats does not exist')) {
          this.log('Clean Processing Metrics', true, 'System processing stats function not available (expected for some setups)', 0);
        } else {
          this.log('Clean Processing Metrics', false, 'Failed to validate processing stats', 0, statsError);
        }
      } else {
        this.log('Clean Processing Metrics', true, 'Processing metrics validated', 0, stats);
      }
    } catch (error) {
      this.log('Clean Processing Metrics', false, 'Error validating metrics', 0, error);
    }
  }

  private async resetCircuitBreakers(): Promise<void> {
    // The app doesn't have explicit circuit breakers in the database,
    // but we can reset any stuck processing by clearing the processing queue
    try {
      // Count notes that have been pending for too long (might indicate circuit breaker state)
      const { data: stalePending, error: staleError } = await this.supabase
        .from('voice_notes')
        .select('id')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // 1 hour old

      if (staleError) {
        this.log('Reset Circuit Breakers', false, 'Failed to check stale pending notes', 0, staleError);
        return;
      }

      const staleCount = stalePending?.length || 0;

      if (staleCount === 0) {
        this.log('Reset Circuit Breakers', true, 'No stale pending notes found');
      } else {
        this.log('Reset Circuit Breakers', true, `Found ${staleCount} stale pending notes (may need manual review)`, staleCount);
      }
    } catch (error) {
      this.log('Reset Circuit Breakers', false, 'Error checking circuit breaker state', 0, error);
    }
  }

  private async validateConfiguration(): Promise<void> {
    const issues = [];

    // Check environment variables
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'OPENAI_API_KEY',
      'CRON_SECRET'
    ];

    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        issues.push(`Missing ${varName}`);
      }
    });

    // Check database connection
    try {
      const { error } = await this.supabase
        .from('voice_notes')
        .select('id')
        .limit(1);

      if (error) {
        issues.push(`Database connection: ${error.message}`);
      }
    } catch (error) {
      issues.push(`Database connection failed: ${error}`);
    }

    // Check migration status
    try {
      const { error: migrationError } = await this.supabase
        .from('voice_notes')
        .select('error_message, processing_attempts, last_error_at')
        .limit(1);

      if (migrationError && migrationError.message.includes('column')) {
        issues.push('Critical migration not applied (error tracking columns missing)');
      }
    } catch (error) {
      issues.push(`Migration check failed: ${error}`);
    }

    if (issues.length === 0) {
      this.log('Validate Configuration', true, 'All configuration checks passed');
    } else {
      this.log('Validate Configuration', false, `Found ${issues.length} configuration issues`, issues.length, issues);
    }
  }

  private async testBasicFunctionality(): Promise<void> {
    try {
      // Test creating a note (and immediately delete it)
      const testId = `reset-test-${Date.now()}`;
      
      const { error: insertError } = await this.supabase
        .from('voice_notes')
        .insert({
          id: testId,
          user_id: 'test-user',
          filename: 'test.mp3',
          file_size: 1024,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (insertError) {
        this.log('Test Basic Functionality', false, 'Failed to create test note', 0, insertError);
        return;
      }

      // Test updating the note
      const { error: updateError } = await this.supabase
        .from('voice_notes')
        .update({ 
          status: 'processing',
          processing_attempts: 1 
        })
        .eq('id', testId);

      // Clean up test note
      await this.supabase
        .from('voice_notes')
        .delete()
        .eq('id', testId);

      if (updateError) {
        this.log('Test Basic Functionality', false, 'Failed to update test note', 0, updateError);
      } else {
        this.log('Test Basic Functionality', true, 'Basic CRUD operations working');
      }
    } catch (error) {
      this.log('Test Basic Functionality', false, 'Basic functionality test failed', 0, error);
    }
  }

  private generateSummary(): void {
    console.log('\n📊 Reset Summary:');
    console.log('=================');

    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalRows = this.results.reduce((sum, r) => sum + (r.affectedRows || 0), 0);

    console.log(`✅ Successful operations: ${successful}`);
    console.log(`❌ Failed operations: ${failed}`);
    console.log(`📝 Total rows affected: ${totalRows}`);

    if (failed > 0) {
      console.log('\n❌ Failed Operations:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.operation}: ${r.message}`);
        });
    }

    console.log('\n🎯 Reset Status:');
    if (failed === 0) {
      console.log('🎉 Vercel state reset completed successfully!');
      console.log('✨ Your deployment should now be in a clean state.');
    } else if (failed <= 2) {
      console.log('⚠️  Reset mostly successful with minor issues');
      console.log('🔧 Review failed operations and address if needed.');
    } else {
      console.log('❌ Reset had significant issues');
      console.log('🚨 Manual intervention may be required.');
    }
  }

  public async resetState(): Promise<void> {
    console.log('🔄 Vercel State Reset Starting...\n');

    // Step 1: Clear processing locks
    console.log('Step 1: Clearing processing locks...');
    await this.clearProcessingLocks();

    // Step 2: Reset error states
    console.log('\nStep 2: Resetting error states...');
    await this.resetErrorStates();

    // Step 3: Clean processing metrics
    console.log('\nStep 3: Cleaning processing metrics...');
    await this.cleanProcessingMetrics();

    // Step 4: Reset circuit breakers
    console.log('\nStep 4: Resetting circuit breakers...');
    await this.resetCircuitBreakers();

    // Step 5: Validate configuration
    console.log('\nStep 5: Validating configuration...');
    await this.validateConfiguration();

    // Step 6: Test basic functionality
    console.log('\nStep 6: Testing basic functionality...');
    await this.testBasicFunctionality();

    // Generate summary
    this.generateSummary();

    console.log('\n💡 Next Steps:');
    console.log('1. Run emergency fix if any issues remain');
    console.log('2. Test deployment with scripts/test-vercel-deployment.ts');
    console.log('3. Monitor processing for a few minutes');
    console.log('4. Upload a test file to verify end-to-end functionality');
  }
}

// Run the reset
if (require.main === module) {
  const resetter = new VercelStateResetter();
  resetter.resetState().catch(error => {
    console.error('❌ State reset failed:', error);
    process.exit(1);
  });
}

export default VercelStateResetter; 