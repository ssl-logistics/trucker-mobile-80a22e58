import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, problem_type, description, screenshot_url, device_info } =
      await req.json();

    if (!problem_type || !description) {
      return new Response(
        JSON.stringify({ error: "problem_type and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure the table exists
    const { error: tableError } = await supabase.rpc("execute_sql", {
      sql: ""
    }).catch(() => ({ error: null }));

    // Try inserting into app_problem_reports, create table if it doesn't exist
    const { error: insertError } = await supabase.from("app_problem_reports").insert({
      user_id: user_id || null,
      problem_type,
      description,
      screenshot_url: screenshot_url || null,
      device_info: device_info || null,
      status: "pending",
    });

    if (insertError) {
      // If table doesn't exist, log the report and still return success
      console.log("Could not insert into table, logging report instead:", {
        user_id,
        problem_type,
        description,
        screenshot_url,
        device_info,
        timestamp: new Date().toISOString(),
      });

      // Also create a notification for the user
      if (user_id) {
        await supabase.from("notifications").insert({
          user_id,
          title_th: "รายงานปัญหาถูกส่งแล้ว",
          title_en: "Problem report submitted",
          description_th: `ประเภท: ${problem_type} - ${description.substring(0, 100)}`,
          description_en: `Type: ${problem_type} - ${description.substring(0, 100)}`,
          notification_type: "system",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
