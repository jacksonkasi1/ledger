import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if a specific user_id was provided (from trigger)
    let specificUserId = null;
    try {
      const body = await req.json();
      specificUserId = body?.user_id;
    } catch (e) {
      // No body or invalid JSON - check all users
    }

    console.log("Checking budget alerts", specificUserId ? `for user: ${specificUserId}` : "for all users");

    // Get active budget alerts, optionally filtered by user
    let query = supabaseClient
      .from("budget_alerts")
      .select(`
        *,
        categories(name),
        user_profiles(email, first_name)
      `)
      .eq("is_active", true);

    if (specificUserId) {
      query = query.eq("user_id", specificUserId);
    }

    const { data: alerts, error: alertsError } = await query;

    if (alertsError) {
      throw alertsError;
    }

    const notifications = [];
    const emailResults = [];

    for (const alert of alerts || []) {
      // Calculate current period spending
      const now = new Date();
      let startDate: Date;

      switch (alert.period) {
        case "weekly":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "yearly":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          continue;
      }

      // Get spending for this period
      let query = supabaseClient
        .from("expenses")
        .select("amount")
        .eq("user_id", alert.user_id)
        .gte("date", startDate.toISOString().split("T")[0]);

      if (alert.category_id) {
        query = query.eq("category_id", alert.category_id);
      }

      const { data: expenses, error: expensesError } = await query;

      if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
        continue;
      }

      const totalSpending = expenses?.reduce((sum, expense) => sum + parseFloat(expense.amount), 0) || 0;
      const percentageUsed = (totalSpending / alert.amount_limit) * 100;

      // Send alert if over 80% of budget
      if (percentageUsed >= 80) {
        const notification = {
          user_id: alert.user_id,
          email: alert.user_profiles?.email,
          category: alert.categories?.name || "All categories",
          spent: totalSpending,
          limit: alert.amount_limit,
          percentage: percentageUsed,
          period: alert.period
        };

        notifications.push(notification);

        // Send email notification
        if (notification.email) {
          try {
            console.log(`Sending budget alert email to ${notification.email}`);
            
            const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-budget-alert-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                userEmail: notification.email,
                spentAmount: notification.spent,
                limitAmount: notification.limit,
                period: notification.period
              })
            });

            const emailResult = await emailResponse.json();
            
            if (emailResponse.ok) {
              console.log(`Email sent successfully to ${notification.email}`);
              emailResults.push({
                email: notification.email,
                success: true,
                messageId: emailResult.messageId
              });
            } else {
              console.error(`Failed to send email to ${notification.email}:`, emailResult.error);
              emailResults.push({
                email: notification.email,
                success: false,
                error: emailResult.error
              });
            }
          } catch (emailError) {
            console.error(`Error sending email to ${notification.email}:`, emailError);
            emailResults.push({
              email: notification.email,
              success: false,
              error: emailError.message
            });
          }
        }
      }
    }

    console.log(`Found ${notifications.length} budget alerts to send`);
    console.log(`Email results:`, emailResults);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_checked: alerts?.length || 0,
        notifications_found: notifications.length,
        emails_sent: emailResults.filter(r => r.success).length,
        email_failures: emailResults.filter(r => !r.success).length,
        notifications,
        email_results: emailResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error checking budget alerts:", error);
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
