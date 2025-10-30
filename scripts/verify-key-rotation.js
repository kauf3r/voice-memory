#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Verifying Supabase Key Rotation');
console.log('==================================\n');

async function verifyKeys() {
  try {
    // Load environment variables
    const envPath = '.env.local';
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env.local file not found');
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });

    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY'
    ];

    console.log('📋 Checking environment variables...');
    
    for (const varName of requiredVars) {
      if (!envVars[varName]) {
        console.error(`❌ Missing ${varName}`);
        return;
      }
      console.log(`✅ ${varName}: ${envVars[varName].substring(0, 20)}...`);
    }

    console.log('\n🔐 Testing Supabase connections...');

    // Test anon key connection
    console.log('\n📋 Testing anon key connection...');
    try {
      const anonClient = createClient(
        envVars.NEXT_PUBLIC_SUPABASE_URL,
        envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: anonData, error: anonError } = await anonClient
        .from('notes')
        .select('count')
        .limit(1);

      if (anonError) {
        console.error('❌ Anon key test failed:', anonError.message);
      } else {
        console.log('✅ Anon key connection successful');
      }
    } catch (error) {
      console.error('❌ Anon key connection error:', error.message);
    }

    // Test service key connection
    console.log('\n📋 Testing service key connection...');
    try {
      const serviceClient = createClient(
        envVars.NEXT_PUBLIC_SUPABASE_URL,
        envVars.SUPABASE_SERVICE_KEY
      );

      const { data: serviceData, error: serviceError } = await serviceClient
        .from('notes')
        .select('count')
        .limit(1);

      if (serviceError) {
        console.error('❌ Service key test failed:', serviceError.message);
      } else {
        console.log('✅ Service key connection successful');
      }
    } catch (error) {
      console.error('❌ Service key connection error:', error.message);
    }

    // Test authentication
    console.log('\n📋 Testing authentication...');
    try {
      const serviceClient = createClient(
        envVars.NEXT_PUBLIC_SUPABASE_URL,
        envVars.SUPABASE_SERVICE_KEY
      );

      const { data: { user }, error: authError } = await serviceClient.auth.getUser();
      
      if (authError) {
        console.error('❌ Authentication test failed:', authError.message);
      } else {
        console.log('✅ Authentication successful');
      }
    } catch (error) {
      console.error('❌ Authentication error:', error.message);
    }

    console.log('\n🎉 Key rotation verification completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Test your application locally: npm run dev');
    console.log('2. Test your deployed application');
    console.log('3. If everything works, delete old keys from Supabase Dashboard');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyKeys();
