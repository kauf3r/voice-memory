#!/usr/bin/env node

const https = require('https');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function getAccessToken() {
  try {
    // Try to get the access token from the CLI
    const result = execSync('supabase projects list -o json', { encoding: 'utf8' });
    // If this works, we're authenticated
    return 'authenticated';
  } catch (error) {
    return null;
  }
}

async function rotateSecret() {
  console.log('🔄 Supabase Service Role Secret Rotator');
  console.log('=====================================\n');

  // Check if we're authenticated
  const authStatus = getAccessToken();
  if (!authStatus) {
    console.error('❌ Not authenticated with Supabase CLI');
    console.log('Please run: supabase login');
    rl.close();
    return;
  }

  console.log('✅ Authenticated with Supabase CLI');

  const projectRef = 'vbjszugsvrqxosbtffqw';
  
  console.log(`\n📋 Project: ${projectRef}`);
  console.log('🔍 Getting current API keys...\n');

  try {
    // Get current API keys using CLI
    const apiKeysResult = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: 'utf8' });
    const apiKeys = JSON.parse(apiKeysResult);
    
    const serviceRoleKey = apiKeys.find(key => key.type === 'secret' && key.secret_jwt_template?.role === 'service_role');

    if (!serviceRoleKey) {
      console.error('❌ No service role secret key found');
      rl.close();
      return;
    }

    console.log(`🔑 Current service role key ID: ${serviceRoleKey.id}`);
    console.log(`📅 Created: ${serviceRoleKey.inserted_at}`);
    console.log(`🔄 Last updated: ${serviceRoleKey.updated_at}\n`);

    // Confirm rotation
    const confirm = await new Promise((resolve) => {
      rl.question('⚠️  This will invalidate the current service role key. Continue? (y/N): ', resolve);
    });

    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Rotation cancelled');
      rl.close();
      return;
    }

    console.log('\n🔄 Rotating service role secret...');

    // Since we can't use the Management API directly, let's use the CLI approach
    // We'll need to use the dashboard approach
    console.log('\n📋 Since the CLI doesn\'t support rotating secrets directly,');
    console.log('you need to rotate the secret through the Supabase Dashboard:');
    console.log('\n🔗 https://supabase.com/dashboard/project/vbjszugsvrqxosbtffqw/settings/api');
    console.log('\n📝 Steps:');
    console.log('1. Go to the API settings page');
    console.log('2. Find the "service_role" key');
    console.log('3. Click "Rotate"');
    console.log('4. Copy the new key');
    console.log('5. Come back here and I\'ll help you update all configuration files');

    const newKey = await new Promise((resolve) => {
      rl.question('\n🔑 Paste the new service role key here: ', resolve);
    });

    if (!newKey || newKey.trim() === '') {
      console.log('❌ No key provided');
      rl.close();
      return;
    }

    console.log('\n✅ Got the new key! Now updating configuration files...');

    // Update the .claude/settings.local.json file
    try {
      const fs = require('fs');
      const settingsPath = '.claude/settings.local.json';
      
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        // Find and replace the old service key in permissions
        let updated = false;
        if (settings.permissions && settings.permissions.allow) {
          settings.permissions.allow = settings.permissions.allow.map(permission => {
            if (permission.includes('SUPABASE_SERVICE_KEY=')) {
              updated = true;
              return permission.replace(
                /SUPABASE_SERVICE_KEY="[^"]*"/,
                `SUPABASE_SERVICE_KEY="${newKey.trim()}"`
              );
            }
            return permission;
          });
        }

        if (updated) {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          console.log('✅ Updated .claude/settings.local.json');
        } else {
          console.log('⚠️  No service key found in .claude/settings.local.json');
        }
      }
    } catch (error) {
      console.error('❌ Error updating .claude/settings.local.json:', error.message);
    }

    console.log('\n📋 Next steps:');
    console.log('1. Update your .env.local file with the new key');
    console.log('2. Update your Vercel environment variables (if deployed)');
    console.log('3. Restart your development server');
    console.log('4. Test your application');

    console.log('\n🔑 New service role key:');
    console.log(newKey.trim());

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

rotateSecret().catch(console.error); 