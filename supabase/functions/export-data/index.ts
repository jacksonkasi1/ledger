
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
    const { user_id, format = "csv", start_date, end_date } = await req.json();

    if (!user_id) {
      throw new Error("User ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build query
    let query = supabaseClient
      .from("expenses")
      .select(`
        *,
        categories(name)
      `)
      .eq("user_id", user_id)
      .order("date", { ascending: false });

    if (start_date) {
      query = query.gte("date", start_date);
    }
    if (end_date) {
      query = query.lte("date", end_date);
    }

    const { data: expenses, error } = await query;

    if (error) {
      throw error;
    }

    if (format === "csv") {
      // Generate CSV
      const headers = ["Date", "Amount", "Description", "Vendor", "Category"];
      const rows = expenses?.map(expense => [
        expense.date,
        expense.amount,
        expense.description,
        expense.vendor,
        expense.categories?.name || "Other"
      ]) || [];

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(field => `"${field}"`).join(","))
      ].join("\n");

      return new Response(csvContent, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=expenses.csv"
        },
      });
    }

    // Return JSON by default
    return new Response(
      JSON.stringify({ expenses }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error exporting data:", error);
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
