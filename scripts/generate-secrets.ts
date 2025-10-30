#!/usr/bin/env ts-node
/**
 * Generate Secrets Script
 *
 * Generates strong random secrets for JWT_SECRET and CRON_SECRET.
 * These secrets are used for authentication and security in production.
 *
 * Usage:
 *   npm run generate-secrets
 *   or
 *   npx ts-node scripts/generate-secrets.ts
 */

import * as crypto from 'crypto';

interface Secret {
  name: string;
  value: string;
  description: string;
}

class SecretGenerator {
  /**
   * Generate a cryptographically secure random string
   */
  private generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate all required secrets
   */
  generateAllSecrets(): Secret[] {
    return [
      {
        name: 'JWT_SECRET',
        value: this.generateSecret(32),
        description: 'Used for application-level JWT token validation',
      },
      {
        name: 'CRON_SECRET',
        value: this.generateSecret(32),
        description: 'Used for authenticating cron job requests',
      },
    ];
  }

  /**
   * Print secrets in various formats
   */
  printSecrets(secrets: Secret[]): void {
    console.log('\n🔐 Generated Secrets\n');
    console.log('═'.repeat(80));
    console.log('Copy these values to your Vercel environment variables');
    console.log('═'.repeat(80));
    console.log();

    // Plain format
    console.log('📋 Plain Format (for .env files):\n');
    for (const secret of secrets) {
      console.log(`${secret.name}=${secret.value}`);
    }

    console.log();
    console.log('─'.repeat(80));
    console.log();

    // Vercel format
    console.log('🚀 Vercel Dashboard Format:\n');
    console.log('Go to: Vercel Dashboard → Your Project → Settings → Environment Variables\n');
    for (const secret of secrets) {
      console.log(`Name:  ${secret.name}`);
      console.log(`Value: ${secret.value}`);
      console.log(`Env:   Production`);
      console.log(`Info:  ${secret.description}`);
      console.log();
    }

    console.log('─'.repeat(80));
    console.log();

    // Security notes
    console.log('🔒 Security Notes:\n');
    console.log('• Keep these secrets private and secure');
    console.log('• Never commit secrets to version control');
    console.log('• Use different secrets for different environments');
    console.log('• Rotate secrets periodically (recommended: every 90 days)');
    console.log('• Store backup securely (password manager recommended)');
    console.log();

    // Vercel CLI format (bonus)
    console.log('💻 Vercel CLI Commands:\n');
    for (const secret of secrets) {
      console.log(`vercel env add ${secret.name} production`);
      console.log(`# When prompted, paste: ${secret.value}`);
      console.log();
    }

    console.log('─'.repeat(80));
    console.log();

    // Additional required variables reminder
    console.log('📝 Don\'t Forget These Required Variables:\n');
    const additionalVars = [
      'NEXT_PUBLIC_SUPABASE_URL - From Supabase Dashboard',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY - From Supabase Dashboard',
      'SUPABASE_SERVICE_KEY - From Supabase Dashboard',
      'SUPABASE_JWT_SECRET - From Supabase Dashboard → Settings → API',
      'OPENAI_API_KEY - From OpenAI Platform',
      'NEXT_PUBLIC_APP_URL - Your production domain',
      'CORS_ORIGINS - Your production domain (matches APP_URL)',
    ];

    for (const varInfo of additionalVars) {
      console.log(`• ${varInfo}`);
    }

    console.log();
    console.log('📖 See ENVIRONMENT_VARIABLES.md for complete reference');
    console.log();
  }

  /**
   * Save secrets to a file (optional)
   */
  saveToFile(secrets: Secret[], filename: string = '.secrets'): void {
    const content = secrets.map((s) => `${s.name}=${s.value}`).join('\n');

    try {
      const fs = require('fs');
      const path = require('path');
      const filepath = path.join(process.cwd(), filename);

      fs.writeFileSync(filepath, content + '\n', { mode: 0o600 }); // Readable only by owner

      console.log(`✅ Secrets saved to ${filename}`);
      console.log(`⚠️  Remember to delete this file after copying secrets to Vercel!`);
      console.log(`   Run: rm ${filename}\n`);
    } catch (error: any) {
      console.error(`❌ Failed to save secrets to file: ${error.message}`);
    }
  }

  /**
   * Main execution
   */
  run(): void {
    const secrets = this.generateAllSecrets();
    this.printSecrets(secrets);

    // Ask if user wants to save to file
    const args = process.argv.slice(2);
    if (args.includes('--save') || args.includes('-s')) {
      const filename = args.includes('--file')
        ? args[args.indexOf('--file') + 1]
        : '.secrets';
      this.saveToFile(secrets, filename);
    } else {
      console.log('💡 Tip: Use --save flag to save secrets to a file');
      console.log('   Example: npm run generate-secrets -- --save\n');
    }
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🔐 Secret Generator\n');
    console.log('Generate cryptographically secure secrets for production deployment.\n');
    console.log('Usage:');
    console.log('  npm run generate-secrets');
    console.log('  npm run generate-secrets -- --save');
    console.log('  npm run generate-secrets -- --save --file custom.env\n');
    console.log('Options:');
    console.log('  --save, -s       Save secrets to a file');
    console.log('  --file <name>    Specify output filename (default: .secrets)');
    console.log('  --help, -h       Show this help message\n');
    process.exit(0);
  }

  const generator = new SecretGenerator();
  generator.run();
}

// Handle errors
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run
main();
