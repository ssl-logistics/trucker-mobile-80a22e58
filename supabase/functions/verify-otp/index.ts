import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Store OTPs in memory (shared with send-otp - in production use database)
const otpStore = new Map<string, { code: string; expires: number }>();

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const storedOTP = otpStore.get(phone);

    if (!storedOTP) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "OTP not found or expired" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP expired
    if (Date.now() > storedOTP.expires) {
      otpStore.delete(phone);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "OTP has expired" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify OTP
    if (storedOTP.code !== otp) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid OTP" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // OTP is valid - remove it
    otpStore.delete(phone);

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
