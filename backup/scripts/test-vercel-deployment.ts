#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration?: number;
  details?: any;
}

class VercelDeploymentTester {
  private supabase: any;
  private baseUrl: string;
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

    // Determine base URL
    this.baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private async runTest(
    testName: string, 
    testFn: () => Promise<{ success: boolean; message: string; details?: any }>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        test: testName,
        status: result.success ? 'pass' : 'fail',
        message: result.message,
        duration,
        details: result.details
      });

      const statusIcon = result.success ? '✅' : '❌';
      console.log(`${statusIcon} ${testName}: ${result.message} (${duration}ms)`);
      
      if (!result.success && result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        test: testName,
        status: 'fail',
        message: `Test threw error: ${error}`,
        duration,
        details: error
      });

      console.log(`❌ ${testName}: Test error (${duration}ms)`);
      console.log(`   Error: ${error}`);
    }
  }

  private async testEnvironmentVariables(): Promise<{ success: boolean; message: string; details?: any }> {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
              'SUPABASE_SERVICE_KEY', 
      'OPENAI_API_KEY',
      'CRON_SECRET'
    ];

    const optional = [
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'VERCEL_URL',
      'NEXT_PUBLIC_APP_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    const present = required.filter(key => process.env[key]);
    const optionalPresent = optional.filter(key => process.env[key]);

    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing ${missing.length} required variables`,
        details: { missing, present, optionalPresent }
      };
    }

    return {
      success: true,
      message: `All ${required.length} required variables present`,
      details: { present, optionalPresent }
    };
  }

  private async testDatabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { data, error } = await this.supabase
        .from('voice_notes')
        .select('id')
        .limit(1);

      if (error) {
        return {
          success: false,
          message: 'Database connection failed',
          details: error
        };
      }

      return {
        success: true,
        message: 'Database connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Database connection error',
        details: error
      };
    }
  }

  private async testMigrationStatus(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Check for error tracking columns
      const { data, error } = await this.supabase
        .from('voice_notes')
        .select('error_message, processing_attempts, last_error_at')
        .limit(1);

      if (error && error.message.includes('column')) {
        return {
          success: false,
          message: 'Critical migration missing - error tracking columns not found',
          details: error
        };
      }

      // Check for database functions
      const { error: funcError } = await this.supabase.rpc('get_system_processing_stats');
      
      if (funcError) {
        return {
          success: false,
          message: 'Database functions missing',
          details: funcError
        };
      }

      return {
        success: true,
        message: 'All migrations applied successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Migration check failed',
        details: error
      };
    }
  }

  private async testHealthEndpoint(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          message: `Health endpoint returned ${response.status}`,
          details: { status: response.status, body: responseText }
        };
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }

      return {
        success: true,
        message: 'Health endpoint responding',
        details: data
      };
    } catch (error) {
      return {
        success: false,
        message: 'Health endpoint unreachable',
        details: error
      };
    }
  }

  private async testUploadEndpoint(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test with invalid data to check endpoint is accessible
      const response = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });

      // We expect this to fail with a 400 (validation error), not 500 (server error)
      if (response.status === 500) {
        return {
          success: false,
          message: 'Upload endpoint has server error',
          details: { status: response.status }
        };
      }

      return {
        success: true,
        message: 'Upload endpoint accessible',
        details: { status: response.status }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Upload endpoint unreachable',
        details: error
      };
    }
  }

  private async testCronEndpoint(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!process.env.CRON_SECRET) {
      return {
        success: false,
        message: 'CRON_SECRET not configured'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });

      if (response.status === 401) {
        return {
          success: false,
          message: 'Cron authentication failed',
          details: { status: response.status }
        };
      }

      if (response.status >= 500) {
        return {
          success: false,
          message: 'Cron endpoint has server error',
          details: { status: response.status }
        };
      }

      return {
        success: true,
        message: 'Cron endpoint accessible',
        details: { status: response.status }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Cron endpoint unreachable',
        details: error
      };
    }
  }

  private async testProcessingPipeline(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Create a test note
      const testId = `test-${Date.now()}`;
      const testNote = {
        id: testId,
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
        return {
          success: false,
          message: 'Cannot create test note',
          details: insertError
        };
      }

      // Try to update with error tracking fields
      const { error: updateError } = await this.supabase
        .from('voice_notes')
        .update({
          status: 'processing',
          processing_attempts: 1,
          error_message: null
        })
        .eq('id', testId);

      // Clean up test note
      await this.supabase
        .from('voice_notes')
        .delete()
        .eq('id', testId);

      if (updateError) {
        return {
          success: false,
          message: 'Error tracking fields not working',
          details: updateError
        };
      }

      return {
        success: true,
        message: 'Processing pipeline functional'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Processing pipeline test failed',
        details: error
      };
    }
  }

  private async testPerformance(): Promise<{ success: boolean; message: string; details?: any }> {
    const results = [];

    // Test health endpoint performance
    const healthStart = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const healthTime = Date.now() - healthStart;
      results.push({ endpoint: '/api/health', time: healthTime, status: response.status });
    } catch (error) {
      results.push({ endpoint: '/api/health', time: Date.now() - healthStart, error: true });
    }

    // Test database query performance
    const dbStart = Date.now();
    try {
      await this.supabase.from('voice_notes').select('id').limit(1);
      const dbTime = Date.now() - dbStart;
      results.push({ operation: 'database_query', time: dbTime });
    } catch (error) {
      results.push({ operation: 'database_query', time: Date.now() - dbStart, error: true });
    }

    const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
    const slowOperations = results.filter(r => r.time > 2000);

    if (slowOperations.length > 0) {
      return {
        success: false,
        message: `${slowOperations.length} operations > 2s`,
        details: { average: avgTime, results, slowOperations }
      };
    }

    return {
      success: true,
      message: `Average response time: ${Math.round(avgTime)}ms`,
      details: { average: avgTime, results }
    };
  }

  private async testProcessingStats(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { data, error } = await this.supabase.rpc('get_system_processing_stats');

      if (error) {
        return {
          success: false,
          message: 'Processing stats function failed',
          details: error
        };
      }

      return {
        success: true,
        message: 'Processing stats working',
        details: data
      };
    } catch (error) {
      return {
        success: false,
        message: 'Processing stats error',
        details: error
      };
    }
  }

  public async runAllTests(): Promise<void> {
    console.log('🧪 Vercel Deployment Test Starting...\n');
    console.log(`📍 Testing deployment at: ${this.baseUrl}\n`);

    // Environment Tests
    console.log('🔧 Environment Tests:');
    await this.runTest('Environment Variables', () => this.testEnvironmentVariables());

    // Database Tests
    console.log('\n💾 Database Tests:');
    await this.runTest('Database Connection', () => this.testDatabaseConnection());
    await this.runTest('Migration Status', () => this.testMigrationStatus());
    await this.runTest('Processing Stats Function', () => this.testProcessingStats());

    // API Endpoint Tests
    console.log('\n🌐 API Endpoint Tests:');
    await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
    await this.runTest('Upload Endpoint', () => this.testUploadEndpoint());
    await this.runTest('Cron Endpoint', () => this.testCronEndpoint());

    // Processing Tests
    console.log('\n⚙️  Processing Tests:');
    await this.runTest('Processing Pipeline', () => this.testProcessingPipeline());

    // Performance Tests
    console.log('\n⚡ Performance Tests:');
    await this.runTest('Response Times', () => this.testPerformance());

    // Generate Summary
    this.generateSummary();
  }

  private generateSummary(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const total = this.results.length;

    // Results breakdown
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📊 Total: ${total}`);

    // Performance metrics
    const durations = this.results.filter(r => r.duration).map(r => r.duration!);
    if (durations.length > 0) {
      const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      const maxDuration = Math.max(...durations);
      console.log(`⏱️  Average: ${avgDuration}ms, Max: ${maxDuration}ms`);
    }

    // Failed tests details
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`   • ${r.test}: ${r.message}`);
        });
    }

    // Overall status
    console.log('\n🎯 Overall Status:');
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED - Deployment is fully operational!');
      console.log('✨ Your Voice Memory app should be working perfectly on Vercel.');
    } else if (failed <= 2) {
      console.log('⚠️  MOSTLY WORKING - Minor issues detected');
      console.log('🔧 Review failed tests and apply fixes if needed.');
    } else {
      console.log('❌ DEPLOYMENT ISSUES - Multiple failures detected');
      console.log('🚨 Run emergency fix scripts to resolve critical issues.');
    }

    console.log(`\n📋 Full report: ${passed}/${total} tests passed`);
  }
}

// Run the tests
if (require.main === module) {
  const tester = new VercelDeploymentTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export default VercelDeploymentTester; 