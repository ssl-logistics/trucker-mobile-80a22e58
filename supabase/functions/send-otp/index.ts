import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const THAIBULKSMS_API_KEY = Deno.env.get("THAIBULKSMS_API_KEY");
const THAIBULKSMS_API_SECRET = Deno.env.get("THAIBULKSMS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Store token temporarily for same-instance reuse (frontend already passes token back to verify)
const tokenStore = new Map<string, { token: string; expires: number }>();

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!THAIBULKSMS_API_KEY || !THAIBULKSMS_API_SECRET) {
      console.error("ThailBulkSMS credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ThaiBulkSMS OTP accepts formats like 0812345678, 668..., +668...
    // Keep the user's 10-digit local format as-is to avoid losing leading zero
    const msisdn = String(phone).trim();
    console.log(`Requesting OTP for phone: ${msisdn}`);

    // Request OTP from ThaiBulkSMS (correct domain per official docs/PDF)
    const url = "https://otp.thaibulksms.com/v2/otp/request";

    const formData = new URLSearchParams();
    formData.append("key", THAIBULKSMS_API_KEY);
    formData.append("secret", THAIBULKSMS_API_SECRET);
    formData.append("msisdn", msisdn);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Non-JSON response from ThaiBulkSMS:", text);
      return new Response(
        JSON.stringify({ error: "Failed to send OTP", details: text }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("ThaiBulkSMS request response:", data);

    if (!res.ok || data?.status !== "success" || !data?.token) {
      return new Response(
        JSON.stringify({ error: "Failed to send OTP", details: data }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cache token (5 minutes) for same-instance verification fallback
    tokenStore.set(msisdn, { token: data.token, expires: Date.now() + 5 * 60 * 1000 });

    return new Response(
      JSON.stringify({ success: true, token: data.token, refno: data.refno }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

export { tokenStore };
