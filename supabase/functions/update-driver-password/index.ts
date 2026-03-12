import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_API_URL = "https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1";
const DRIVER_API_KEY = "fld_sk_2026_xY9kWewT3xNySk8kGsRq_live";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { driver_id, driver_type, new_password } = await req.json();

    if (!driver_id || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: "driver_id and new_password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward request to external API
    const response = await fetch(`${EXTERNAL_API_URL}/update-driver-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DRIVER_API_KEY,
      },
      body: JSON.stringify({ driver_id, driver_type, new_password }),
    });

    const data = await response.json();
    console.log("External API response:", { status: response.status, data });

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error proxying update-driver-password:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
