#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  function: string;
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

class SystemProcessingStatsTest {
  private supabase: any;
  private results: TestResult[] = [];

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

  private log(functionName: string, success: boolean, message: string, data?: any, error?: any) {
    const result: TestResult = { function: functionName, success, message, data, error };
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${functionName}: ${message}`);
    
    if (success && data) {
      console.log(`   Data:`, JSON.stringify(data, null, 2));
    }
    
    if (!success && error) {
      console.log(`   Error:`, JSON.stringify(error, null, 2));
    }
  }

  private async testSystemProcessingStats(): Promise<void> {
    try {
      const { data, error } = await this.supabase.rpc('get_system_processing_stats');
      
      if (error) {
        this.log('get_system_processing_stats', false, 'Function call failed', null, error);
        return;
      }

      if (!data || data.length === 0) {
        this.log('get_system_processing_stats', false, 'No data returned');
        return;
      }

      const stats = data[0];
      const requiredFields = ['total', 'pending', 'processing', 'completed', 'failed', 'users_with_notes', 'avg_processing_time_minutes', 'error_rate'];
      const missingFields = requiredFields.filter(field => stats[field] === undefined);

      if (missingFields.length > 0) {
        this.log('get_system_processing_stats', false, `Missing fields: ${missingFields.join(', ')}`, stats);
        return;
      }

      // Validate data types and ranges
      const validationErrors = [];
      if (typeof stats.total !== 'string' || isNaN(Number(stats.total))) validationErrors.push('total should be numeric');
      if (typeof stats.pending !== 'string' || isNaN(Number(stats.pending))) validationErrors.push('pending should be numeric');
      if (typeof stats.processing !== 'string' || isNaN(Number(stats.processing))) validationErrors.push('processing should be numeric');
      if (typeof stats.completed !== 'string' || isNaN(Number(stats.completed))) validationErrors.push('completed should be numeric');
      if (typeof stats.failed !== 'string' || isNaN(Number(stats.failed))) validationErrors.push('failed should be numeric');
      if (typeof stats.users_with_notes !== 'string' || isNaN(Number(stats.users_with_notes))) validationErrors.push('users_with_notes should be numeric');
      if (isNaN(Number(stats.avg_processing_time_minutes))) validationErrors.push('avg_processing_time_minutes should be numeric');
      if (isNaN(Number(stats.error_rate))) validationErrors.push('error_rate should be numeric');

      if (validationErrors.length > 0) {
        this.log('get_system_processing_stats', false, `Validation errors: ${validationErrors.join(', ')}`, stats);
        return;
      }

      this.log('get_system_processing_stats', true, 'Function works correctly', stats);
    } catch (error) {
      this.log('get_system_processing_stats', false, 'Unexpected error', null, error);
    }
  }

  private async testSystemHealthStats(): Promise<void> {
    try {
      const { data, error } = await this.supabase.rpc('get_system_health_stats');
      
      if (error) {
        this.log('get_system_health_stats', false, 'Function call failed', null, error);
        return;
      }

      if (!data || data.length === 0) {
        this.log('get_system_health_stats', false, 'No data returned');
        return;
      }

      const health = data[0];
      const requiredFields = ['status', 'total_notes', 'stuck_processing', 'recent_errors', 'system_healthy'];
      const missingFields = requiredFields.filter(field => health[field] === undefined);

      if (missingFields.length > 0) {
        this.log('get_system_health_stats', false, `Missing fields: ${missingFields.join(', ')}`, health);
        return;
      }

      // Validate data types
      const validationErrors = [];
      if (typeof health.status !== 'string') validationErrors.push('status should be string');
      if (typeof health.total_notes !== 'string' || isNaN(Number(health.total_notes))) validationErrors.push('total_notes should be numeric');
      if (typeof health.stuck_processing !== 'string' || isNaN(Number(health.stuck_processing))) validationErrors.push('stuck_processing should be numeric');
      if (typeof health.recent_errors !== 'string' || isNaN(Number(health.recent_errors))) validationErrors.push('recent_errors should be numeric');
      if (typeof health.system_healthy !== 'boolean') validationErrors.push('system_healthy should be boolean');

      if (validationErrors.length > 0) {
        this.log('get_system_health_stats', false, `Validation errors: ${validationErrors.join(', ')}`, health);
        return;
      }

      this.log('get_system_health_stats', true, 'Function works correctly', health);
    } catch (error) {
      this.log('get_system_health_stats', false, 'Unexpected error', null, error);
    }
  }

  private async testUserProcessingStats(): Promise<void> {
    try {
      // Test with a sample user (if any exist)
      const { data: users, error: usersError } = await this.supabase
        .from('notes')
        .select('user_id')
        .limit(1);

      if (usersError || !users || users.length === 0) {
        this.log('get_processing_stats (user)', true, 'No users to test with (normal for empty database)');
        return;
      }

      const sampleUserId = users[0].user_id;
      const { data, error } = await this.supabase.rpc('get_processing_stats', { p_user_id: sampleUserId });
      
      if (error) {
        this.log('get_processing_stats (user)', false, 'Function call failed', null, error);
        return;
      }

      if (!data || data.length === 0) {
        this.log('get_processing_stats (user)', false, 'No data returned');
        return;
      }

      const stats = data[0];
      const requiredFields = ['total', 'pending', 'processing', 'completed', 'failed'];
      const missingFields = requiredFields.filter(field => stats[field] === undefined);

      if (missingFields.length > 0) {
        this.log('get_processing_stats (user)', false, `Missing fields: ${missingFields.join(', ')}`, stats);
        return;
      }

      this.log('get_processing_stats (user)', true, 'Function works correctly', stats);
    } catch (error) {
      this.log('get_processing_stats (user)', false, 'Unexpected error', null, error);
    }
  }

  private generateSummary(): void {
    console.log('\n📊 Test Summary:');
    console.log('================');

    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(`✅ Successful tests: ${successful}`);
    console.log(`❌ Failed tests: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   • ${r.function}: ${r.message}`);
        });
    }

    console.log('\n🎯 Status:');
    if (failed === 0) {
      console.log('🎉 All system processing stats functions are working correctly!');
    } else {
      console.log('⚠️  Some functions have issues. Check the migration status.');
    }
  }

  public async runTests(): Promise<void> {
    console.log('🧪 Testing System Processing Stats Functions...\n');

    // Test 1: System processing stats (administrative)
    console.log('Test 1: System processing stats...');
    await this.testSystemProcessingStats();

    // Test 2: System health stats
    console.log('\nTest 2: System health stats...');
    await this.testSystemHealthStats();

    // Test 3: User processing stats (original function)
    console.log('\nTest 3: User processing stats...');
    await this.testUserProcessingStats();

    // Generate summary
    this.generateSummary();

    console.log('\n💡 Usage Examples:');
    console.log('==================');
    console.log('// Administrative stats (no user_id required):');
    console.log('const { data } = await supabase.rpc(\'get_system_processing_stats\')');
    console.log('');
    console.log('// Quick health check:');
    console.log('const { data } = await supabase.rpc(\'get_system_health_stats\')');
    console.log('');
    console.log('// User-specific stats:');
    console.log('const { data } = await supabase.rpc(\'get_processing_stats\', { p_user_id: userId })');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SystemProcessingStatsTest();
  tester.runTests().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export default SystemProcessingStatsTest; 