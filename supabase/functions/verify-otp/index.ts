import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const THAIBULKSMS_API_KEY = Deno.env.get("THAIBULKSMS_API_KEY");
const THAIBULKSMS_API_SECRET = Deno.env.get("THAIBULKSMS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Optional same-instance cache (frontend passes token as well)
const tokenStore = new Map<string, { token: string; expires: number }>();

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp, token } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
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

    const msisdn = String(phone).trim();

    // Resolve token: prefer provided from client; else fallback to cache if available
    let verifyToken = token;
    if (!verifyToken) {
      const cached = tokenStore.get(msisdn);
      if (!cached || Date.now() > cached.expires) {
        return new Response(
          JSON.stringify({ success: false, error: "Token not found or expired. Please request a new OTP." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      verifyToken = cached.token;
    }

    console.log(`Verifying OTP for ${msisdn} with token ${verifyToken}`);

    // Verify OTP with ThaiBulkSMS (correct domain per official docs/PDF)
    const url = "https://otp.thaibulksms.com/v2/otp/verify";

    const formData = new URLSearchParams();
    formData.append("key", THAIBULKSMS_API_KEY);
    formData.append("secret", THAIBULKSMS_API_SECRET);
    formData.append("token", verifyToken);
    formData.append("pin", String(otp));

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
      console.error("Non-JSON response from ThaiBulkSMS verify:", text);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify OTP", details: text }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("ThaiBulkSMS verify response:", data);

    if (res.ok && data?.status === "success") {
      tokenStore.delete(msisdn);
      return new Response(
        JSON.stringify({ success: true, message: "OTP verified successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: data?.message || "Invalid OTP", details: data }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
