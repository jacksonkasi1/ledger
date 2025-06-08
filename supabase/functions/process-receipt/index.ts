
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostmarkInboundEmail {
  From: string;
  To: string;
  Subject: string;
  HtmlBody: string;
  TextBody: string;
  Attachments: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
  MessageID: string;
  Date: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`Received ${req.method} request to process-receipt function`);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests (Postmark webhooks use POST)
  if (req.method !== "POST") {
    console.log(`Method ${req.method} not allowed. This endpoint only accepts POST requests from Postmark.`);
    return new Response(
      JSON.stringify({ 
        error: "Method not allowed", 
        message: "This endpoint only accepts POST requests from Postmark webhooks" 
      }),
      {
        status: 405,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Allow": "POST, OPTIONS"
        },
      }
    );
  }

  try {
    console.log("Processing inbound email from Postmark");
    
    // Use service role key for database operations since this is a webhook
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY not configured");
      throw new Error("GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Parse request body with better error handling
    let emailData: PostmarkInboundEmail;
    try {
      const requestText = await req.text();
      console.log("Raw request body length:", requestText.length);
      console.log("Raw request body preview:", requestText.substring(0, 200));
      
      if (!requestText || requestText.trim() === '') {
        throw new Error("Empty request body");
      }
      
      emailData = JSON.parse(requestText);
      console.log("Successfully parsed email data");
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body", 
          message: "Failed to parse JSON from request body",
          details: parseError.message 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Received email from:", emailData.From);
    console.log("Email subject:", emailData.Subject);
    console.log("Email has TextBody:", !!emailData.TextBody);
    console.log("Email has HtmlBody:", !!emailData.HtmlBody);

    // Extract text content for AI analysis
    const emailContent = emailData.TextBody || emailData.HtmlBody;
    
    if (!emailContent) {
      console.log("No email content found");
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "No email content found to process" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Email content length:", emailContent.length);
    console.log("Email content preview:", emailContent.substring(0, 300));

    const prompt = `
    Analyze this receipt email and extract the following information in JSON format:
    - amount: the total amount as a number (without currency symbols)
    - description: a brief description of the purchase
    - vendor: the merchant/vendor name
    - category: one of these categories: "Food & Dining", "Shopping", "Transportation", "Entertainment", "Health & Medical", "Bills & Utilities", "Travel", "Business", "Education", "Other"
    - date: the transaction date in YYYY-MM-DD format (if not found, use today's date)

    Email content:
    ${emailContent}

    Return only valid JSON without any markdown formatting or additional text.
    `;

    console.log("Sending request to Gemini API");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Raw Gemini response:", text);
    console.log("Gemini response length:", text.length);

    let expenseData;
    try {
      // Clean up the response by removing markdown formatting
      let cleanedText = text.trim();
      
      // Remove markdown code blocks
      cleanedText = cleanedText.replace(/```json\s*/g, '');
      cleanedText = cleanedText.replace(/```\s*/g, '');
      cleanedText = cleanedText.replace(/^`+|`+$/g, '');
      
      // Try to find JSON within the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      console.log("Cleaned text for parsing:", cleanedText);
      
      expenseData = JSON.parse(cleanedText);
      console.log("Successfully parsed expense data:", expenseData);
      
      // Validate required fields
      if (!expenseData.amount && expenseData.amount !== 0) {
        console.log("Amount not found, setting to 0");
        expenseData.amount = 0;
      }
      if (!expenseData.vendor) {
        console.log("Vendor not found, setting default");
        expenseData.vendor = 'Unknown Vendor';
      }
      if (!expenseData.description) {
        console.log("Description not found, setting default");
        expenseData.description = 'Email receipt processing';
      }
      if (!expenseData.category) {
        console.log("Category not found, setting to Other");
        expenseData.category = 'Other';
      }
      if (!expenseData.date) {
        console.log("Date not found, using today");
        expenseData.date = new Date().toISOString().split('T')[0];
      }
      
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Original text:", text);
      console.error("Cleaned text:", cleanedText);
      
      // Fallback data
      expenseData = {
        amount: 0,
        vendor: 'Unknown Vendor',
        description: 'Failed to process receipt automatically',
        category: 'Other',
        date: new Date().toISOString().split('T')[0]
      };
      console.log("Using fallback expense data:", expenseData);
    }

    // Get category ID from name
    console.log("Looking up category:", expenseData.category);
    const { data: categories, error: categoryError } = await supabaseClient
      .from("categories")
      .select("id")
      .eq("name", expenseData.category)
      .single();

    if (categoryError) {
      console.log("Category lookup error:", categoryError);
      console.log("Will create expense without category_id");
    } else {
      console.log("Found category:", categories);
    }

    console.log("Looking up user by email:", emailData.From);

    // Try to find user by email address
    const { data: userProfile, error: userError } = await supabaseClient
      .from("user_profiles")
      .select("user_id")
      .eq("email", emailData.From)
      .single();

    if (userError || !userProfile) {
      console.log("User lookup error or no user found:", userError);
      console.log("No user found for email:", emailData.From);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "No user account found for this email address. Please sign up first and ensure your account email matches the sender email.",
          email: emailData.From
        }),
        {
          status: 200, // Return 200 so Postmark doesn't retry
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Found user profile:", userProfile);
    console.log("Creating expense record");

    const expenseRecord = {
      amount: parseFloat(expenseData.amount) || 0,
      description: expenseData.description,
      vendor: expenseData.vendor,
      category_id: categories?.id || null,
      date: expenseData.date,
      receipt_email: emailData.From,
      raw_email_data: emailData,
      user_id: userProfile.user_id
    };

    console.log("Expense record to insert:", expenseRecord);

    const { data: expense, error } = await supabaseClient
      .from("expenses")
      .insert(expenseRecord)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Created expense successfully:", expense);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expense: expense,
        message: "Receipt processed successfully",
        processedData: expenseData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error processing receipt:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
