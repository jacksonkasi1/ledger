// Test script for budget alerts functionality
// Run this with: node test-budget-alerts.js

const SUPABASE_URL = 'your-project-url-here'; // Replace with your actual URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with your actual key

async function testBudgetAlerts() {
  console.log('🧪 Testing Budget Alerts System...\n');

  try {
    // Test 1: Check if the send-budget-alerts function is accessible
    console.log('1. Testing budget alerts function accessibility...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-budget-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Budget alerts function is accessible');
      console.log(`   - Alerts checked: ${result.alerts_checked}`);
      console.log(`   - Notifications found: ${result.notifications_found}`);
      console.log(`   - Emails sent: ${result.emails_sent}`);
      
      if (result.notifications_found > 0) {
        console.log('🎯 FOUND BUDGET ALERTS TO SEND!');
        console.log('   Details:', JSON.stringify(result.notifications, null, 2));
      }
    } else {
      console.log('❌ Budget alerts function error:', result.error);
    }

    // Test 2: Check email function
    console.log('\n2. Testing email function accessibility...');
    
    const emailTest = await fetch(`${SUPABASE_URL}/functions/v1/send-budget-alert-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userEmail: 'test@example.com',
        spentAmount: 100,
        limitAmount: 80,
        period: 'monthly'
      })
    });

    const emailResult = await emailTest.json();
    
    if (emailTest.ok) {
      console.log('✅ Email function is accessible and working');
    } else {
      console.log('❌ Email function error:', emailResult.error);
      if (emailResult.error.includes('POSTMARK_SERVER_TOKEN')) {
        console.log('   💡 Tip: Make sure POSTMARK_SERVER_TOKEN is set in Supabase');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('💡 Tip: Make sure to replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual values');
    }
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Update the SUPABASE_URL and SUPABASE_ANON_KEY in this test file');
  console.log('2. Run the database migrations');
  console.log('3. Deploy the functions: supabase functions deploy');
  console.log('4. Add an expense to test the trigger');
  console.log('5. Check your email for budget alerts');
}

// Configuration check
if (SUPABASE_URL.includes('your-project-url-here') || SUPABASE_ANON_KEY.includes('your-anon-key-here')) {
  console.log('⚠️  Please update SUPABASE_URL and SUPABASE_ANON_KEY in this file before running the test');
  console.log('You can find these values in your Supabase project dashboard under Settings > API');
} else {
  testBudgetAlerts();
}
