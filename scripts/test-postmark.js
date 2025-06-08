const postmark = require("postmark");

// Configuration
const POSTMARK_TOKEN = "your_postmark_server_token_here"; // Your token
const FROM_EMAIL = "your_verified_email@yourdomain.com"; // Your verified domain email
// const TO_EMAIL = "test@blackhole.postmarkapp.com"; // Test email (safe to use)
const TO_EMAIL = "jacksonkasi@jacksonkasi.xyz"; // Test email (safe to use)

// Initialize Postmark client
const client = new postmark.ServerClient(POSTMARK_TOKEN);

async function testEmail() {
  try {
    console.log("🚀 Testing Postmark email...");
    console.log(`From: ${FROM_EMAIL}`);
    console.log(`To: ${TO_EMAIL}`);
    
    const result = await client.sendEmail({
      "From": FROM_EMAIL,
      "To": TO_EMAIL,
      "Subject": "Postmark Test Email",
      "HtmlBody": "<h1>Hello from Postmark!</h1><p>This is a test email to verify the setup.</p>",
      "TextBody": "Hello from Postmark! This is a test email to verify the setup.",
      "MessageStream": "outbound"
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", result.MessageID);
    console.log("Submitted at:", result.SubmittedAt);
    
  } catch (error) {
    console.error("❌ Error sending email:");
    console.error("Error Code:", error.code || "N/A");
    console.error("Error Message:", error.message);
    
    // Handle specific Postmark errors
    if (error.message.includes("413")) {
      console.log("\n💡 Account not approved yet. Try:");
      console.log("1. Request approval in Postmark dashboard");
      console.log("2. Use test@blackhole.postmarkapp.com for testing");
      console.log("3. Send only to your verified domain emails");
    }
  }
}

// Run the test
testEmail();
