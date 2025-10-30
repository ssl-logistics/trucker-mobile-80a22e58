import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const THAIBULKSMS_API_KEY = Deno.env.get("THAIBULKSMS_API_KEY");
const THAIBULKSMS_API_SECRET = Deno.env.get("THAIBULKSMS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Store tokens from ThailBulkSMS (shared with send-otp)
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

    // Get token from store or use provided token
    let verifyToken = token;
    if (!verifyToken) {
      const storedData = tokenStore.get(phone);
      if (!storedData) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Token not found or expired. Please request a new OTP." 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Check if token expired
      if (Date.now() > storedData.expires) {
        tokenStore.delete(phone);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Token has expired. Please request a new OTP." 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      verifyToken = storedData.token;
    }

    console.log(`Verifying OTP for phone: ${phone}, token: ${verifyToken}, otp: ${otp}`);

    // Verify OTP with ThailBulkSMS
    const thaibulksmsUrl = "https://otp-api.thaibulksms.com/v2/otp/verify";
    
    const formData = new URLSearchParams();
    formData.append("key", THAIBULKSMS_API_KEY);
    formData.append("secret", THAIBULKSMS_API_SECRET);
    formData.append("token", verifyToken);
    formData.append("pin", otp);

    const thaibulksmsResponse = await fetch(thaibulksmsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!thaibulksmsResponse.ok) {
      const errorText = await thaibulksmsResponse.text();
      console.error("ThailBulkSMS verify API error:", errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to verify OTP",
          details: errorText
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const responseData = await thaibulksmsResponse.json();
    console.log("ThailBulkSMS verify response:", responseData);

    if (responseData.status === "success") {
      // OTP is valid - remove token from store
      tokenStore.delete(phone);

      console.log(`OTP verified successfully for ${phone}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "OTP verified successfully" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.message || "Invalid OTP"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
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
