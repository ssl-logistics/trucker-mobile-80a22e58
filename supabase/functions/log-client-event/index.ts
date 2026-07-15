// Lightweight endpoint to capture client-side events into edge_function_audit_logs.
// Fire-and-forget from browser. Always returns 200 to avoid blocking client flow.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      event,
      driver_id,
      order_number,
      room_code,
      payload,
      response_status,
      response_body,
      success,
      error_message,
      duration_ms,
    } = body ?? {};

    console.log("[log-client-event] received:", JSON.stringify({ event, order_number, driver_id }));

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error("[log-client-event] missing env:", { hasUrl: !!url, hasKey: !!key });
    } else if (!event) {
      console.warn("[log-client-event] missing event field, body:", JSON.stringify(body));
    } else {
      const supabase = createClient(url, key);
      const { data, error } = await supabase.from("edge_function_audit_logs").insert({
        function_name: `client:${event}`,
        driver_id: driver_id ?? null,
        order_number: order_number ?? null,
        room_code: room_code ?? null,
        request_payload: payload ?? null,
        response_status: response_status ?? null,
        response_body: response_body ?? null,
        success: success ?? null,
        error_message: error_message ?? null,
        duration_ms: duration_ms ?? null,
      }).select();
      if (error) {
        console.error("[log-client-event] insert error:", error.message, error.code, error.details, error.hint);
      } else {
        console.log("[log-client-event] inserted:", data?.[0]?.id);
      }
    }
  } catch (e) {
    console.error("[log-client-event] catch error:", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : undefined);
  }


  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
