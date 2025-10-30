#!/usr/bin/env ts-node
/**
 * Deployment Verification Script
 *
 * Verifies that all critical deployment configurations are correct.
 * Run this after deploying to production to ensure everything is set up properly.
 *
 * Usage:
 *   npm run verify-deployment
 *   or
 *   npx ts-node scripts/verify-deployment.ts <deployment-url>
 *
 * Example:
 *   npx ts-node scripts/verify-deployment.ts https://voice-memory-tau.vercel.app
 */

import * as https from 'https';
import * as http from 'http';

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  message: string;
  details?: string;
}

class DeploymentVerifier {
  private baseUrl: string;
  private results: VerificationResult[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Make HTTP request and return response
   */
  private async makeRequest(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Add result to results array
   */
  private addResult(result: VerificationResult) {
    this.results.push(result);
  }

  /**
   * Verify health endpoint
   */
  async verifyHealthEndpoint(): Promise<void> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/api/health`);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        if (body.status === 'healthy') {
          this.addResult({
            check: 'Health Endpoint',
            status: 'pass',
            message: 'Health check passed',
            details: 'API is responding correctly',
          });
        } else {
          this.addResult({
            check: 'Health Endpoint',
            status: 'fail',
            message: 'Health check returned unexpected response',
            details: JSON.stringify(body),
          });
        }
      } else {
        this.addResult({
          check: 'Health Endpoint',
          status: 'fail',
          message: `Health check failed with status ${response.statusCode}`,
          details: response.body,
        });
      }
    } catch (error: any) {
      this.addResult({
        check: 'Health Endpoint',
        status: 'fail',
        message: 'Health check request failed',
        details: error.message,
      });
    }
  }

  /**
   * Verify security headers
   */
  async verifySecurityHeaders(): Promise<void> {
    try {
      const response = await this.makeRequest(this.baseUrl);
      const headers = response.headers;

      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'referrer-policy',
        'content-security-policy',
        'strict-transport-security',
      ];

      const missingHeaders: string[] = [];
      const presentHeaders: string[] = [];

      for (const header of requiredHeaders) {
        if (headers[header]) {
          presentHeaders.push(header);
        } else {
          missingHeaders.push(header);
        }
      }

      if (missingHeaders.length === 0) {
        this.addResult({
          check: 'Security Headers',
          status: 'pass',
          message: 'All required security headers present',
          details: presentHeaders.join(', '),
        });
      } else if (missingHeaders.length < requiredHeaders.length) {
        this.addResult({
          check: 'Security Headers',
          status: 'warning',
          message: 'Some security headers are missing',
          details: `Missing: ${missingHeaders.join(', ')}`,
        });
      } else {
        this.addResult({
          check: 'Security Headers',
          status: 'fail',
          message: 'Security headers not configured',
          details: 'No security headers found',
        });
      }

      // Check CORS header
      const corsHeader = headers['access-control-allow-origin'];
      if (corsHeader === '*') {
        this.addResult({
          check: 'CORS Configuration',
          status: 'fail',
          message: 'CORS is set to wildcard (*)',
          details: 'This is a security vulnerability. Set CORS_ORIGINS to specific domain.',
        });
      } else if (corsHeader) {
        this.addResult({
          check: 'CORS Configuration',
          status: 'pass',
          message: 'CORS properly configured',
          details: `Origin: ${corsHeader}`,
        });
      } else {
        this.addResult({
          check: 'CORS Configuration',
          status: 'skip',
          message: 'CORS header not found on homepage',
          details: 'CORS may be configured for API routes only',
        });
      }
    } catch (error: any) {
      this.addResult({
        check: 'Security Headers',
        status: 'fail',
        message: 'Failed to check security headers',
        details: error.message,
      });
    }
  }

  /**
   * Verify HTTPS is enforced
   */
  async verifyHTTPS(): Promise<void> {
    if (this.baseUrl.startsWith('https://')) {
      this.addResult({
        check: 'HTTPS Enforcement',
        status: 'pass',
        message: 'Using HTTPS',
      });

      // Try HTTP redirect if applicable
      if (this.baseUrl.includes('vercel.app')) {
        try {
          const httpUrl = this.baseUrl.replace('https://', 'http://');
          const response = await this.makeRequest(httpUrl);

          if (response.statusCode >= 300 && response.statusCode < 400) {
            this.addResult({
              check: 'HTTP to HTTPS Redirect',
              status: 'pass',
              message: 'HTTP automatically redirects to HTTPS',
            });
          } else {
            this.addResult({
              check: 'HTTP to HTTPS Redirect',
              status: 'warning',
              message: 'HTTP does not redirect to HTTPS',
              details: 'Consider enforcing HTTPS redirects',
            });
          }
        } catch (error) {
          // HTTP might be blocked, which is good
          this.addResult({
            check: 'HTTP to HTTPS Redirect',
            status: 'pass',
            message: 'HTTP appears to be blocked (good)',
          });
        }
      }
    } else {
      this.addResult({
        check: 'HTTPS Enforcement',
        status: 'fail',
        message: 'Not using HTTPS',
        details: 'Production should always use HTTPS',
      });
    }
  }

  /**
   * Verify API endpoints are accessible
   */
  async verifyAPIEndpoints(): Promise<void> {
    const endpoints = [
      { path: '/api/health', requiresAuth: false, expectedStatus: 200 },
      { path: '/api/notes', requiresAuth: true, expectedStatus: [401, 403] },
      { path: '/api/tasks', requiresAuth: true, expectedStatus: [401, 403] },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(`${this.baseUrl}${endpoint.path}`);
        const expectedStatuses = Array.isArray(endpoint.expectedStatus)
          ? endpoint.expectedStatus
          : [endpoint.expectedStatus];

        if (expectedStatuses.includes(response.statusCode)) {
          this.addResult({
            check: `API Endpoint: ${endpoint.path}`,
            status: 'pass',
            message: endpoint.requiresAuth
              ? 'Properly requires authentication'
              : 'Accessible without authentication',
            details: `Status: ${response.statusCode}`,
          });
        } else {
          this.addResult({
            check: `API Endpoint: ${endpoint.path}`,
            status: 'warning',
            message: 'Unexpected response status',
            details: `Expected ${expectedStatuses.join(' or ')}, got ${response.statusCode}`,
          });
        }
      } catch (error: any) {
        this.addResult({
          check: `API Endpoint: ${endpoint.path}`,
          status: 'fail',
          message: 'Endpoint not accessible',
          details: error.message,
        });
      }
    }
  }

  /**
   * Check environment configuration (requires local .env access)
   */
  verifyLocalEnvironment(): void {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_JWT_SECRET',
      'OPENAI_API_KEY',
      'CRON_SECRET',
      'JWT_SECRET',
      'NEXT_PUBLIC_APP_URL',
      'CORS_ORIGINS',
    ];

    const missingVars: string[] = [];
    const presentVars: string[] = [];

    for (const varName of requiredVars) {
      if (process.env[varName]) {
        presentVars.push(varName);
      } else {
        missingVars.push(varName);
      }
    }

    if (missingVars.length === 0) {
      this.addResult({
        check: 'Environment Variables (Local)',
        status: 'pass',
        message: 'All required environment variables are set',
        details: `${presentVars.length} variables configured`,
      });
    } else {
      this.addResult({
        check: 'Environment Variables (Local)',
        status: 'warning',
        message: 'Some environment variables are missing locally',
        details: `Missing: ${missingVars.join(', ')}`,
      });
    }

    // Check URL configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const corsOrigins = process.env.CORS_ORIGINS;

    if (appUrl && corsOrigins) {
      if (appUrl === corsOrigins || corsOrigins.includes(appUrl)) {
        this.addResult({
          check: 'URL Configuration',
          status: 'pass',
          message: 'CORS_ORIGINS matches NEXT_PUBLIC_APP_URL',
        });
      } else {
        this.addResult({
          check: 'URL Configuration',
          status: 'warning',
          message: 'CORS_ORIGINS does not match NEXT_PUBLIC_APP_URL',
          details: `APP_URL: ${appUrl}, CORS: ${corsOrigins}`,
        });
      }
    }
  }

  /**
   * Run all verifications
   */
  async runAll(): Promise<void> {
    console.log('\n🔍 Running Deployment Verification...\n');
    console.log(`Target: ${this.baseUrl}\n`);

    // Local environment check
    this.verifyLocalEnvironment();

    // Remote checks
    await this.verifyHTTPS();
    await this.verifyHealthEndpoint();
    await this.verifySecurityHeaders();
    await this.verifyAPIEndpoints();

    // Print results
    this.printResults();
  }

  /**
   * Print verification results
   */
  printResults(): void {
    console.log('\n📊 Verification Results:\n');
    console.log('─'.repeat(80));

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;
    let skipCount = 0;

    for (const result of this.results) {
      const icon =
        result.status === 'pass'
          ? '✅'
          : result.status === 'fail'
          ? '❌'
          : result.status === 'warning'
          ? '⚠️'
          : '⏭️';

      console.log(`${icon} ${result.check}`);
      console.log(`   ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
      console.log();

      if (result.status === 'pass') passCount++;
      if (result.status === 'fail') failCount++;
      if (result.status === 'warning') warningCount++;
      if (result.status === 'skip') skipCount++;
    }

    console.log('─'.repeat(80));
    console.log(
      `\nSummary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings, ${skipCount} skipped\n`
    );

    if (failCount > 0) {
      console.log('❌ Deployment verification FAILED');
      console.log('Please fix the issues above before going to production.\n');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('⚠️  Deployment verification passed with warnings');
      console.log('Consider addressing the warnings above.\n');
      process.exit(0);
    } else {
      console.log('✅ Deployment verification PASSED');
      console.log('All checks passed successfully!\n');
      process.exit(0);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let baseUrl = args[0] || process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    console.error('❌ Error: No deployment URL provided');
    console.error('\nUsage:');
    console.error('  npm run verify-deployment <url>');
    console.error('  or');
    console.error('  npx ts-node scripts/verify-deployment.ts <url>');
    console.error('\nExample:');
    console.error('  npm run verify-deployment https://voice-memory-tau.vercel.app');
    console.error('\nOr set NEXT_PUBLIC_APP_URL environment variable');
    process.exit(1);
  }

  // Ensure URL has protocol
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  const verifier = new DeploymentVerifier(baseUrl);
  await verifier.runAll();
}

// Handle errors
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run main function
main();
