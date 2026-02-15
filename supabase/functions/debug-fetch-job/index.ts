import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const driverId = url.searchParams.get("driver_id") || "050501485055";
    const statuses = ["in_progress", "in_transit", "delivered", "completed"];
    const apiKey = "fld_sk_2026_xY9kWewT3xNySk8kGsRq_live";
    const baseUrl = "https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1";

    const results: Record<string, unknown> = {};

    // Try all endpoints and statuses
    const endpoints = [
      ...statuses.map(s => ({
        name: `get-driver-assigned-jobs(external,${s})`,
        url: `${baseUrl}/get-driver-assigned-jobs?driver_id=${driverId}&driver_type=external&status=${s}&limit=50`
      })),
      ...statuses.map(s => ({
        name: `get-driver-assigned-jobs(internal,${s})`,
        url: `${baseUrl}/get-driver-assigned-jobs?driver_id=${driverId}&driver_type=internal&status=${s}&limit=50`
      })),
      {
        name: "get-factory-assigned-jobs",
        url: `${baseUrl}/get-factory-assigned-jobs?freelance_driver_id=${driverId}&limit=50`
      },
      {
        name: "get-freelance-accepted-jobs",
        url: `${baseUrl}/get-freelance-accepted-jobs?freelance_driver_id=${driverId}`
      }
    ];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep.url, {
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        });
        const data = await resp.json();
        const count = data?.data?.length || 0;
        if (count > 0) {
          results[ep.name] = data;
        } else {
          results[ep.name] = `empty (${count})`;
        }
      } catch (e) {
        results[ep.name] = `error: ${e.message}`;
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
