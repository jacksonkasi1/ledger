import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, spentAmount, limitAmount, period } = await req.json();

    // Validate required fields
    if (!userEmail || !spentAmount || !limitAmount || !period) {
      throw new Error("Missing required fields: userEmail, spentAmount, limitAmount, period");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      throw new Error("Invalid email format");
    }

    const postmarkServerToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "your_verified_email@yourdomain.com";
    
    if (!postmarkServerToken) {
      throw new Error("POSTMARK_SERVER_TOKEN not configured");
    }

    console.log("Sending budget alert email to:", userEmail);
    console.log("From email:", fromEmail);

    const emailData = {
      "From": fromEmail,
      "To": userEmail,
      "Subject": "Budget Alert - Spending Limit Exceeded",
      "HtmlBody": `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Budget Alert</h2>
          <p>Hello,</p>
          <p>Your ${period} spending has exceeded your budget limit:</p>
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Amount Spent:</strong> $${Number(spentAmount).toFixed(2)}</p>
            <p><strong>Budget Limit:</strong> $${Number(limitAmount).toFixed(2)}</p>
            <p><strong>Overage:</strong> $${(Number(spentAmount) - Number(limitAmount)).toFixed(2)}</p>
          </div>
          <p>Consider reviewing your expenses to stay within your budget.</p>
          <p>Best regards,<br>LEDGR Team</p>
        </div>
      `,
      "TextBody": `Budget Alert: Your ${period} spending of $${Number(spentAmount).toFixed(2)} has exceeded your limit of $${Number(limitAmount).toFixed(2)} by $${(Number(spentAmount) - Number(limitAmount)).toFixed(2)}.`,
      "MessageStream": "outbound"
    };

    console.log("Email data:", JSON.stringify(emailData, null, 2));

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': postmarkServerToken
      },
      body: JSON.stringify(emailData)
    });

    const responseText = await response.text();
    console.log("Postmark response status:", response.status);
    console.log("Postmark response:", responseText);

    if (!response.ok) {
      let errorMessage = `Postmark API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.Message) {
          errorMessage += ` - ${errorData.Message}`;
        }
        if (errorData.ErrorCode) {
          errorMessage += ` (Code: ${errorData.ErrorCode})`;
        }
      } catch (e) {
        errorMessage += ` - ${responseText}`;
      }
      throw new Error(errorMessage);
    }

    const result = JSON.parse(responseText);
    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error sending budget alert email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
