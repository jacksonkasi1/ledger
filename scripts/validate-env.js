#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * 
 * This script validates that all required environment variables are set
 * and provides helpful error messages if any are missing.
 */

const fs = require('fs');
const path = require('path');

// Required environment variables
const REQUIRED_ENV_VARS = {
  client: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GEMINI_API_KEY'
  ],
  server: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'POSTMARK_SERVER_TOKEN',
    'FROM_EMAIL'
  ]
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('📝 Please copy .env.example to .env and fill in your credentials:');
    console.log('   cp .env.example .env');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return envVars;
}

function validateEnvironmentVariables() {
  console.log('🔍 Validating environment variables...\n');
  
  const envVars = loadEnvFile();
  const missing = [];
  const empty = [];

  // Check client-side variables
  console.log('📱 Client-side variables:');
  REQUIRED_ENV_VARS.client.forEach(varName => {
    if (!(varName in envVars)) {
      missing.push(varName);
      console.log(`   ❌ ${varName} - MISSING`);
    } else if (!envVars[varName] || envVars[varName].includes('your_') || envVars[varName].includes('_here')) {
      empty.push(varName);
      console.log(`   ⚠️  ${varName} - PLACEHOLDER VALUE`);
    } else {
      console.log(`   ✅ ${varName} - OK`);
    }
  });

  console.log('\n🖥️  Server-side variables:');
  REQUIRED_ENV_VARS.server.forEach(varName => {
    if (!(varName in envVars)) {
      missing.push(varName);
      console.log(`   ❌ ${varName} - MISSING`);
    } else if (!envVars[varName] || envVars[varName].includes('your_') || envVars[varName].includes('_here')) {
      empty.push(varName);
      console.log(`   ⚠️  ${varName} - PLACEHOLDER VALUE`);
    } else {
      console.log(`   ✅ ${varName} - OK`);
    }
  });

  console.log('\n' + '='.repeat(50));

  if (missing.length > 0) {
    console.log('\n❌ MISSING VARIABLES:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }

  if (empty.length > 0) {
    console.log('\n⚠️  PLACEHOLDER VALUES DETECTED:');
    empty.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n📝 Please replace placeholder values with your actual credentials.');
  }

  if (missing.length === 0 && empty.length === 0) {
    console.log('\n🎉 All environment variables are properly configured!');
    console.log('✅ Your application should work correctly.');
    return true;
  } else {
    console.log('\n📖 For setup instructions, see:');
    console.log('   - README.md (Quick setup)');
    console.log('   - SECURITY.md (Detailed guide)');
    console.log('   - .env.example (Template)');
    return false;
  }
}

function main() {
  console.log('🔒 Receipt Wise Ledger Pro - Environment Validation\n');
  
  const isValid = validateEnvironmentVariables();
  
  if (!isValid) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvironmentVariables };