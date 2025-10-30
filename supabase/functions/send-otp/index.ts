import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const THAIBULKSMS_API_KEY = Deno.env.get("THAIBULKSMS_API_KEY");
const THAIBULKSMS_API_SECRET = Deno.env.get("THAIBULKSMS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Store tokens from ThailBulkSMS for verification
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

    // Normalize phone number (remove leading 0 if exists)
    const normalizedPhone = phone.startsWith('0') ? phone.substring(1) : phone;
    
    console.log(`Requesting OTP for phone: ${phone} (normalized: ${normalizedPhone})`);

    // Request OTP from ThailBulkSMS
    const thaibulksmsUrl = "https://otp-api.thaibulksms.com/v2/otp/request";
    
    const formData = new URLSearchParams();
    formData.append("key", THAIBULKSMS_API_KEY);
    formData.append("secret", THAIBULKSMS_API_SECRET);
    formData.append("msisdn", normalizedPhone);

    const thaibulksmsResponse = await fetch(thaibulksmsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!thaibulksmsResponse.ok) {
      const errorText = await thaibulksmsResponse.text();
      console.error("ThailBulkSMS API error:", errorText);
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to send OTP",
          details: errorText
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const responseData = await thaibulksmsResponse.json();
    console.log("ThailBulkSMS response:", responseData);

    if (responseData.status === "success" && responseData.token) {
      // Store token with 5 minute expiration
      tokenStore.set(phone, {
        token: responseData.token,
        expires: Date.now() + 5 * 60 * 1000,
      });

      console.log(`OTP sent successfully for ${phone}, token: ${responseData.token}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "OTP sent successfully",
          token: responseData.token
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      console.error("ThailBulkSMS returned error:", responseData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send OTP",
          details: responseData
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

// Export token store for verify function
export { tokenStore };
