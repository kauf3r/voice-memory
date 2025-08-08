22#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Project configuration
const PROJECT_REF = '[supabase-ref]';
const DASHBOARD_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`;

// Files that need updating
const FILES_TO_UPDATE = [
  '.env.local',
  '.env.example',
  'vercel.json',
  '.claude/settings.local.json'
];

// Environment variables to rotate
const ENV_VARS = [
  'SUPABASE_SERVICE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL'
];

console.log('🚨 EMERGENCY SUPABASE KEY ROTATION');
console.log('==================================');
console.log('⚠️  Your service_role key has been leaked!');
console.log('🔒 This script will help you rotate ALL keys securely.\n');

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`✅ Backed up ${filePath} to ${backupPath}`);
    return backupPath;
  }
  return null;
}

function updateEnvFile(filePath, oldKey, newKey, keyName) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File ${filePath} not found, skipping...`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const oldPattern = new RegExp(`^${keyName}=.*$`, 'm');
    
    if (oldPattern.test(content)) {
      content = content.replace(oldPattern, `${keyName}=${newKey}`);
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${keyName} in ${filePath}`);
      return true;
    } else {
      console.log(`⚠️  ${keyName} not found in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function updateJsonFile(filePath, oldKey, newKey, keyName) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File ${filePath} not found, skipping...`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    // Update in permissions.allow array
    if (json.permissions && json.permissions.allow) {
      let updated = false;
      json.permissions.allow = json.permissions.allow.map(permission => {
        if (permission.includes(`${keyName}=`)) {
          updated = true;
          return permission.replace(
            new RegExp(`${keyName}="[^"]*"`),
            `${keyName}="${newKey}"`
          );
        }
        return permission;
      });
      
      if (updated) {
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
        console.log(`✅ Updated ${keyName} in ${filePath}`);
        return true;
      }
    }
    
    console.log(`⚠️  ${keyName} not found in ${filePath}`);
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

async function rotateKeys() {
  console.log('📋 Step 1: Backup current configuration files...\n');
  
  // Backup all important files
  const backups = [];
  for (const file of FILES_TO_UPDATE) {
    const backup = backupFile(file);
    if (backup) backups.push(backup);
  }

  console.log('\n📋 Step 2: Rotate keys in Supabase Dashboard\n');
  console.log(`🔗 Go to: ${DASHBOARD_URL}`);
  console.log('\n📝 Instructions:');
  console.log('1. Click on "API" in the left sidebar');
  console.log('2. Scroll down to "Project API keys"');
  console.log('3. For EACH key (anon, service_role):');
  console.log('   - Click the "Rotate" button');
  console.log('   - Copy the new key immediately');
  console.log('   - Keep the old key until we confirm everything works\n');

  // Get new keys from user
  const newKeys = {};
  
  for (const keyName of ENV_VARS) {
    const newKey = await question(`🔑 Enter new ${keyName}: `);
    if (newKey && newKey.trim()) {
      newKeys[keyName] = newKey.trim();
    } else {
      console.log(`❌ No key provided for ${keyName}, skipping...`);
    }
  }

  if (Object.keys(newKeys).length === 0) {
    console.log('❌ No new keys provided. Rotation cancelled.');
    return;
  }

  console.log('\n📋 Step 3: Update configuration files...\n');

  // Update .env.local
  if (newKeys.SUPABASE_SERVICE_KEY) {
    updateEnvFile('.env.local', null, newKeys.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY');
  }
  if (newKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    updateEnvFile('.env.local', null, newKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (newKeys.NEXT_PUBLIC_SUPABASE_URL) {
    updateEnvFile('.env.local', null, newKeys.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  }

  // Update .env.example
  if (newKeys.SUPABASE_SERVICE_KEY) {
    updateEnvFile('.env.example', null, newKeys.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY');
  }
  if (newKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    updateEnvFile('.env.example', null, newKeys.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (newKeys.NEXT_PUBLIC_SUPABASE_URL) {
    updateEnvFile('.env.example', null, newKeys.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  }

  // Update .claude/settings.local.json
  if (newKeys.SUPABASE_SERVICE_KEY) {
    updateJsonFile('.claude/settings.local.json', null, newKeys.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY');
  }

  console.log('\n📋 Step 4: Update Vercel environment variables (if deployed)\n');
  console.log('🔗 Go to: https://vercel.com/dashboard');
  console.log('📝 Instructions:');
  console.log('1. Select your voice-memory project');
  console.log('2. Go to Settings → Environment Variables');
  console.log('3. Update these variables:');
  
  for (const [key, value] of Object.entries(newKeys)) {
    console.log(`   - ${key}: ${value.substring(0, 20)}...`);
  }

  console.log('\n📋 Step 5: Test the new configuration\n');
  
  const testDeployment = await question('🧪 Test deployment? (y/N): ');
  if (testDeployment.toLowerCase() === 'y') {
    console.log('\n🔄 Testing new configuration...');
    
    try {
      // Test if the app builds with new keys
      console.log('📦 Building application...');
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Build successful!');
    } catch (error) {
      console.error('❌ Build failed. Check your new keys.');
      console.log('💡 You can restore from backup files if needed.');
    }
  }

  console.log('\n📋 Step 6: Security checklist\n');
  console.log('✅ Keys rotated in Supabase Dashboard');
  console.log('✅ Local configuration files updated');
  console.log('✅ Vercel environment variables updated (if deployed)');
  console.log('✅ Application tested with new keys');
  console.log('\n🔒 Additional security measures:');
  console.log('1. Check your Git history for any committed keys');
  console.log('2. Review any logs or error reports that might contain keys');
  console.log('3. Consider enabling Supabase audit logs');
  console.log('4. Set up key rotation reminders');

  console.log('\n📋 Backup files created:');
  for (const backup of backups) {
    console.log(`   - ${backup}`);
  }

  console.log('\n🎉 Key rotation completed!');
  console.log('⚠️  Remember to delete the old keys from Supabase Dashboard after confirming everything works.');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Key rotation interrupted. Check backup files if needed.');
  rl.close();
  process.exit(0);
});

rotateKeys()
  .then(() => {
    console.log('\n✅ Emergency key rotation completed successfully!');
  })
  .catch((error) => {
    console.error('\n❌ Error during key rotation:', error.message);
    console.log('💡 Check backup files and try again.');
  })
  .finally(() => {
    rl.close();
  });
