#!/usr/bin/env npx tsx

/**
 * Script to generate environment variables checklist for Vercel deployment
 * This helps ensure all required variables are properly configured
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load local environment variables
dotenv.config({ path: '.env.local' });

const REQUIRED_VARS = [
  { 
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for Whisper transcription and GPT analysis',
    example: 'sk-proj-...',
    sensitive: true
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    example: 'https://your-project.supabase.co',
    sensitive: false
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous/public key',
    example: 'eyJhbGciOiJ...',
    sensitive: false
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    description: 'Supabase service role key (for server-side operations)',
    example: 'eyJhbGciOiJ...',
    sensitive: true
  },
  {
    name: 'CRON_SECRET',
    description: 'Secret key for authenticating cron job requests',
    example: 'Generated 32+ character random string',
    sensitive: true
  }
];

const OPTIONAL_VARS = [
  {
    name: 'OPENAI_WHISPER_MODEL',
    description: 'Whisper model to use',
    default: 'whisper-1',
    example: 'whisper-1'
  },
  {
    name: 'OPENAI_GPT_MODEL',
    description: 'GPT model to use for analysis',
    default: 'gpt-4-turbo-preview',
    example: 'gpt-4-turbo-preview'
  },
  {
    name: 'BATCH_SIZE',
    description: 'Number of notes to process in each batch',
    default: '5',
    example: '5'
  },
  {
    name: 'OPENAI_WHISPER_RATE_LIMIT',
    description: 'Whisper API rate limit (requests per minute)',
    default: '50',
    example: '50'
  },
  {
    name: 'OPENAI_GPT_RATE_LIMIT',
    description: 'GPT API rate limit (requests per minute)',
    default: '200',
    example: '200'
  }
];

console.log('🔍 Voice Memory - Vercel Environment Variables Checklist\n');
console.log('=' .repeat(60));
console.log('\n📋 REQUIRED Environment Variables:\n');

let missingRequired = 0;

REQUIRED_VARS.forEach(varDef => {
  const value = process.env[varDef.name];
  const status = value ? '✅' : '❌';
  const localValue = value ? (varDef.sensitive ? '***' + value.slice(-4) : value) : 'NOT SET';
  
  console.log(`${status} ${varDef.name}`);
  console.log(`   Description: ${varDef.description}`);
  console.log(`   Local value: ${localValue}`);
  console.log(`   Example: ${varDef.example}`);
  console.log();
  
  if (!value) missingRequired++;
});

console.log('\n📋 OPTIONAL Environment Variables:\n');

OPTIONAL_VARS.forEach(varDef => {
  const value = process.env[varDef.name];
  const status = value ? '✅' : '⚪';
  
  console.log(`${status} ${varDef.name}`);
  console.log(`   Description: ${varDef.description}`);
  console.log(`   Current: ${value || `Not set (default: ${varDef.default})`}`);
  console.log();
});

console.log('=' .repeat(60));
console.log('\n🚀 Vercel Deployment Instructions:\n');
console.log('1. Go to: https://vercel.com/dashboard');
console.log('2. Select your "voice-memory" project');
console.log('3. Navigate to: Settings → Environment Variables');
console.log('4. Add/Update each REQUIRED variable listed above');
console.log('5. Copy the exact values from your local .env.local file');
console.log('6. Click "Save" after adding all variables');
console.log('7. Redeploy your application for changes to take effect');
console.log('\n⚡ Quick Redeploy: After saving variables, go to Deployments tab');
console.log('   and click the "..." menu on the latest deployment, then "Redeploy"');

if (missingRequired > 0) {
  console.log(`\n⚠️  WARNING: ${missingRequired} required variable(s) missing locally!`);
  console.log('   Make sure to set these in your .env.local file first.');
}

// Generate a .env.vercel template file
const templatePath = path.join(process.cwd(), '.env.vercel.template');
let template = '# Vercel Environment Variables Template\n';
template += '# Copy these to your Vercel project settings\n\n';

template += '# REQUIRED VARIABLES\n';
REQUIRED_VARS.forEach(varDef => {
  const value = process.env[varDef.name];
  template += `# ${varDef.description}\n`;
  if (value && !varDef.sensitive) {
    template += `${varDef.name}=${value}\n\n`;
  } else if (value && varDef.sensitive) {
    template += `${varDef.name}=<copy from .env.local>\n\n`;
  } else {
    template += `${varDef.name}=<not set locally>\n\n`;
  }
});

template += '# OPTIONAL VARIABLES\n';
OPTIONAL_VARS.forEach(varDef => {
  const value = process.env[varDef.name];
  template += `# ${varDef.description} (default: ${varDef.default})\n`;
  template += `# ${varDef.name}=${value || varDef.default}\n\n`;
});

fs.writeFileSync(templatePath, template);
console.log(`\n📄 Template file created: ${templatePath}`);
console.log('   This file contains a template of all variables to copy to Vercel.');