#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { config as appConfig } from '../lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

interface FileValidation {
  path: string;
  exists: boolean;
  isValid: boolean;
  issue?: string;
  exports?: string[];
}

interface ConfigValidation {
  valid: boolean;
  issues: string[];
  cronPath?: string;
  functionTimeout?: number;
  schedule?: string;
}

interface EnvironmentValidation {
  variable: string;
  exists: boolean;
  value?: string;
  required: boolean;
}

interface DeploymentHealthReport {
  timestamp: string;
  environment: 'local' | 'production';
  fileStructure: {
    valid: boolean;
    files: FileValidation[];
    recommendations: string[];
  };
  vercelConfig: ConfigValidation;
  environmentVariables: EnvironmentValidation[];
  functionDeployment: {
    accessible: boolean;
    endpoints: Record<string, boolean>;
    issues: string[];
  };
  overallHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    summary: string;
    actionItems: string[];
  };
}

async function validateFileStructure(): Promise<{valid: boolean, files: FileValidation[], recommendations: string[]}> {
  console.log('\n📂 Validating File Structure...');
  
  const requiredFiles: Array<{path: string, description: string}> = [
    // API Routes (App Directory)
    { path: 'app/api/process/batch/route.ts', description: 'Unified batch processing endpoint' },
    { path: 'app/api/process/route.ts', description: 'Individual note processing endpoint' },
    
    // Core Libraries
    { path: 'lib/cron-auth.ts', description: 'Cron authentication utilities' },
    { path: 'lib/processing-service.ts', description: 'Processing service logic' },
    { path: 'lib/openai.ts', description: 'OpenAI integration' },
    { path: 'lib/storage.ts', description: 'Storage utilities' },
    
    // Configuration
    { path: 'vercel.json', description: 'Vercel deployment configuration' },
    { path: 'next.config.js', description: 'Next.js configuration' },
    { path: 'package.json', description: 'Package dependencies' },
    { path: 'tsconfig.json', description: 'TypeScript configuration' }
  ];

  const validations: FileValidation[] = [];
  const recommendations: string[] = [];
  let allValid = true;

  for (const file of requiredFiles) {
    const fullPath = join(__dirname, '..', file.path);
    const exists = existsSync(fullPath);
    let isValid = exists;
    let issue: string | undefined;
    let exports: string[] | undefined;

    if (exists) {
      // Additional validation for specific files
      if (file.path.endsWith('route.ts')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          
          // Check for POST export
          if (!content.includes('export async function POST')) {
            isValid = false;
            issue = 'Missing POST function export';
          }
          
          // Extract exports
          const exportMatches = content.match(/export\s+(?:async\s+)?function\s+(\w+)/g);
          if (exportMatches) {
            exports = exportMatches.map(match => {
              const funcName = match.match(/function\s+(\w+)/)?.[1];
              return funcName || '';
            }).filter(Boolean);
          }
        } catch (error) {
          isValid = false;
          issue = 'Unable to read file contents';
        }
      }
    } else {
      issue = 'File not found';
      recommendations.push(`Create missing file: ${file.path} - ${file.description}`);
    }

    validations.push({
      path: file.path,
      exists,
      isValid,
      issue,
      exports
    });

    if (!isValid) {
      allValid = false;
    }

    const status = isValid ? '✅' : '❌';
    console.log(`  ${status} ${file.path} ${issue ? `- ${issue}` : ''}`);
  }

  // Check for unexpected files in API directories
  try {
    const apiDir = join(__dirname, '..', 'app', 'api');
    await checkDirectoryStructure(apiDir, 'app/api', recommendations);
  } catch (error) {
    recommendations.push('Unable to scan API directory structure');
  }

  return { valid: allValid, files: validations, recommendations };
}

async function checkDirectoryStructure(dir: string, relativePath: string, recommendations: string[]) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = join(relativePath, entry.name);
        const fullPath = join(dir, entry.name);
        
        // Check if route.ts exists in this directory
        const routePath = join(fullPath, 'route.ts');
        if (!existsSync(routePath) && !['lib', 'utils', 'types'].includes(entry.name)) {
          // This might be an incomplete API route
          const hasSubRoutes = existsSync(fullPath);
          if (hasSubRoutes) {
            await checkDirectoryStructure(fullPath, subPath, recommendations);
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors in directory scanning
  }
}

function validateVercelConfig(): ConfigValidation {
  console.log('\n⚙️  Validating Vercel Configuration...');
  
  const validation: ConfigValidation = {
    valid: true,
    issues: []
  };

  try {
    const configPath = join(__dirname, '..', 'vercel.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // Check cron configuration
    if (config.crons && Array.isArray(config.crons)) {
      const cronJob = config.crons[0];
      if (cronJob) {
        validation.cronPath = cronJob.path;
        validation.schedule = cronJob.schedule;
        
        console.log(`  ✅ Cron job configured: ${cronJob.path}`);
        console.log(`     Schedule: ${cronJob.schedule}`);
        
        // Verify the cron path matches the unified endpoint
        const expectedPath = '/api/process/batch';
        if (cronJob.path !== expectedPath) {
          validation.valid = false;
          validation.issues.push(`Cron path '${cronJob.path}' should be '${expectedPath}'`);
        }
      } else {
        validation.valid = false;
        validation.issues.push('No cron jobs configured');
      }
    } else {
      validation.valid = false;
      validation.issues.push('Missing crons configuration');
    }
    
    // Check function configuration
    if (config.functions) {
      for (const [path, fnConfig] of Object.entries(config.functions)) {
        if (typeof fnConfig === 'object' && fnConfig !== null && 'maxDuration' in fnConfig) {
          const maxDuration = (fnConfig as any).maxDuration;
          console.log(`  ✅ Function timeout: ${path} = ${maxDuration}s`);
          validation.functionTimeout = maxDuration;
        }
      }
    }
    
  } catch (error) {
    validation.valid = false;
    validation.issues.push('Unable to read or parse vercel.json');
  }

  if (validation.issues.length > 0) {
    console.log('  ❌ Configuration issues found:');
    validation.issues.forEach(issue => console.log(`     - ${issue}`));
  }

  return validation;
}

function validateEnvironmentVariables(): EnvironmentValidation[] {
  console.log('\n🔑 Validating Environment Variables...');
  
  const requiredVars = [
    { name: 'CRON_SECRET', required: true, description: 'Authentication for cron jobs' },
    { name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API access' },
    { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase database URL' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
    { name: 'SUPABASE_SERVICE_KEY', required: false, description: 'Supabase service key (optional)' }
  ];

  const validations: EnvironmentValidation[] = [];

  for (const varDef of requiredVars) {
    const value = process.env[varDef.name];
    const exists = !!value;
    
    validations.push({
      variable: varDef.name,
      exists,
      value: exists ? value.substring(0, 10) + '...' : undefined,
      required: varDef.required
    });

    const status = exists ? '✅' : (varDef.required ? '❌' : '⚠️ ');
    console.log(`  ${status} ${varDef.name}: ${exists ? 'Set' : 'Not set'} - ${varDef.description}`);
  }

  return validations;
}

async function testFunctionDeployment(baseUrl: string): Promise<{accessible: boolean, endpoints: Record<string, boolean>, issues: string[]}> {
  console.log('\n🚀 Testing Function Deployment...');
  
  const endpoints = [
    '/api/process/batch',
    '/api/process',
    '/api/upload',
    '/api/notes'
  ];

  const results: Record<string, boolean> = {};
  const issues: string[] = [];
  let allAccessible = true;

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      // Use OPTIONS request to check if endpoint exists without auth
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: { 'Content-Type': 'application/json' }
      });

      // 404 means endpoint doesn't exist
      // 405 means endpoint exists but doesn't support OPTIONS
      // 401 means endpoint exists but requires auth
      // 200/204 means endpoint exists and handles OPTIONS
      const exists = response.status !== 404;
      results[endpoint] = exists;

      if (!exists) {
        allAccessible = false;
        issues.push(`${endpoint} returns 404 - not deployed`);
      }

      const status = exists ? '✅' : '❌';
      console.log(`  ${status} ${endpoint}: ${response.status} ${response.statusText}`);
      
    } catch (error) {
      results[endpoint] = false;
      allAccessible = false;
      issues.push(`${endpoint} - Network error: ${error instanceof Error ? error.message : 'Unknown'}`);
      console.log(`  ❌ ${endpoint}: Network error`);
    }
  }

  return { accessible: allAccessible, endpoints: results, issues };
}

function generateHealthReport(
  fileValidation: {valid: boolean, files: FileValidation[], recommendations: string[]},
  configValidation: ConfigValidation,
  envValidations: EnvironmentValidation[],
  deploymentTest: {accessible: boolean, endpoints: Record<string, boolean>, issues: string[]},
  environment: 'local' | 'production'
): DeploymentHealthReport {
  
  // Determine overall health status
  const criticalIssues = [];
  const warnings = [];

  // Check file structure
  if (!fileValidation.valid) {
    const missingCriticalFiles = fileValidation.files
      .filter(f => !f.exists && f.path.includes('api/process'))
      .map(f => f.path);
    
    if (missingCriticalFiles.length > 0) {
      criticalIssues.push('Critical API files missing');
    }
  }

  // Check config
  if (!configValidation.valid) {
    criticalIssues.push('Vercel configuration issues');
  }

  // Check environment variables
  const missingRequiredVars = envValidations.filter(v => v.required && !v.exists);
  if (missingRequiredVars.length > 0) {
    criticalIssues.push(`Missing required environment variables: ${missingRequiredVars.map(v => v.variable).join(', ')}`);
  }

  // Check deployment
  if (!deploymentTest.accessible && environment === 'production') {
    criticalIssues.push('API endpoints not accessible in production');
  }

  const status: 'healthy' | 'degraded' | 'critical' = 
    criticalIssues.length > 0 ? 'critical' :
    warnings.length > 0 ? 'degraded' : 'healthy';

  // Generate action items
  const actionItems: string[] = [];

  if (status === 'critical') {
    actionItems.push('Fix critical issues before deployment:');
    criticalIssues.forEach(issue => actionItems.push(`  - ${issue}`));
  }

  if (!fileValidation.valid) {
    actionItems.push(...fileValidation.recommendations);
  }

  if (!configValidation.valid) {
    actionItems.push(...configValidation.issues.map(i => `Fix vercel.json: ${i}`));
  }

  if (missingRequiredVars.length > 0) {
    actionItems.push('Set missing environment variables in Vercel dashboard');
  }

  if (!deploymentTest.accessible && environment === 'production') {
    actionItems.push('Check Vercel deployment logs for build errors');
    actionItems.push('Verify API routes are included in build output');
    actionItems.push('Try redeploying the application');
  }

  const summary = status === 'healthy' 
    ? 'All systems operational'
    : status === 'degraded'
    ? 'Minor issues detected'
    : 'Critical issues preventing proper operation';

  return {
    timestamp: new Date().toISOString(),
    environment,
    fileStructure: fileValidation,
    vercelConfig: configValidation,
    environmentVariables: envValidations,
    functionDeployment: deploymentTest,
    overallHealth: {
      status,
      summary,
      actionItems
    }
  };
}

function printHealthReport(report: DeploymentHealthReport) {
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 DEPLOYMENT HEALTH REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n📅 Timestamp: ${report.timestamp}`);
  console.log(`🌐 Environment: ${report.environment.toUpperCase()}`);
  
  // Overall Health Status
  const statusEmoji = 
    report.overallHealth.status === 'healthy' ? '✅' :
    report.overallHealth.status === 'degraded' ? '⚠️ ' : '❌';
  
  console.log(`\n🏥 OVERALL HEALTH: ${statusEmoji} ${report.overallHealth.status.toUpperCase()}`);
  console.log(`   ${report.overallHealth.summary}`);
  
  // Summary by category
  console.log('\n📈 CATEGORY SUMMARY:');
  console.log(`  File Structure: ${report.fileStructure.valid ? '✅ Valid' : '❌ Issues Found'}`);
  console.log(`  Vercel Config: ${report.vercelConfig.valid ? '✅ Valid' : '❌ Issues Found'}`);
  console.log(`  Environment Vars: ${report.environmentVariables.every(v => !v.required || v.exists) ? '✅ All Set' : '❌ Missing Required'}`);
  console.log(`  API Deployment: ${report.functionDeployment.accessible ? '✅ Accessible' : '❌ Issues Found'}`);
  
  // Detailed Issues
  if (report.overallHealth.status !== 'healthy') {
    console.log('\n⚠️  ISSUES DETECTED:');
    
    // File issues
    const missingFiles = report.fileStructure.files.filter(f => !f.exists);
    if (missingFiles.length > 0) {
      console.log('\n  Missing Files:');
      missingFiles.forEach(f => console.log(`    - ${f.path}`));
    }
    
    // Config issues
    if (report.vercelConfig.issues.length > 0) {
      console.log('\n  Configuration Issues:');
      report.vercelConfig.issues.forEach(i => console.log(`    - ${i}`));
    }
    
    // Environment issues
    const missingEnv = report.environmentVariables.filter(v => v.required && !v.exists);
    if (missingEnv.length > 0) {
      console.log('\n  Missing Environment Variables:');
      missingEnv.forEach(v => console.log(`    - ${v.variable}`));
    }
    
    // Deployment issues
    if (report.functionDeployment.issues.length > 0) {
      console.log('\n  Deployment Issues:');
      report.functionDeployment.issues.forEach(i => console.log(`    - ${i}`));
    }
  }
  
  // Action Items
  if (report.overallHealth.actionItems.length > 0) {
    console.log('\n🔧 ACTION ITEMS:');
    report.overallHealth.actionItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
  }
  
  // Next Steps
  console.log('\n📌 NEXT STEPS:');
  if (report.overallHealth.status === 'healthy') {
    console.log('  ✅ System is healthy - monitor cron execution');
    console.log('  ✅ Check Vercel Functions logs for any runtime errors');
  } else {
    console.log('  1. Address critical issues listed above');
    console.log('  2. Run diagnose-cron-deployment.ts to test endpoints');
    console.log('  3. Check Vercel deployment logs for additional details');
    console.log('  4. Re-run this verification after fixes');
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes('--production') || args.includes('-p');
  
  const environment: 'local' | 'production' = isProduction ? 'production' : 'local';
  const baseUrl = isProduction 
    ? appConfig.baseUrl
    : 'http://localhost:3000';
  
  console.log(`\n🚀 Voice Memory Deployment Verification`);
  console.log(`Environment: ${environment}`);
  console.log(`Base URL: ${baseUrl}`);
  
  try {
    // Run all validations
    const fileValidation = await validateFileStructure();
    const configValidation = validateVercelConfig();
    const envValidations = validateEnvironmentVariables();
    
    let deploymentTest = {
      accessible: false,
      endpoints: {} as Record<string, boolean>,
      issues: ['Skipped - running locally'] as string[]
    };
    
    if (isProduction) {
      deploymentTest = await testFunctionDeployment(baseUrl);
    } else {
      console.log('\n🚀 Skipping deployment tests (local environment)');
      console.log('   Run with --production to test production deployment');
    }
    
    // Generate and print report
    const report = generateHealthReport(
      fileValidation,
      configValidation,
      envValidations,
      deploymentTest,
      environment
    );
    
    printHealthReport(report);
    
    // Exit with appropriate code
    process.exit(report.overallHealth.status === 'critical' ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Fatal error during verification:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { validateFileStructure, validateVercelConfig, validateEnvironmentVariables };