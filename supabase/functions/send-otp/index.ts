import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const USE_TEST_MODE = Deno.env.get("TWILIO_TEST_MODE") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Store OTPs in memory (for demo - in production use database)
const otpStore = new Map<string, { code: string; expires: number }>();

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with 5 minute expiration
    otpStore.set(phone, {
      code: otp,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    console.log(`Generated OTP for ${phone}: ${otp}`);

    // Check if in test mode
    if (USE_TEST_MODE || !TWILIO_PHONE_NUMBER || TWILIO_PHONE_NUMBER.startsWith('+66')) {
      console.log(`TEST MODE: OTP ${otp} generated for ${phone}`);
      console.log(`⚠️ Twilio not configured properly. Using test mode.`);
      console.log(`To use real SMS:`);
      console.log(`1. Get a Twilio phone number from: https://console.twilio.com/us1/develop/phone-numbers/manage/search`);
      console.log(`2. Update TWILIO_PHONE_NUMBER secret with format: +1234567890 (not +66)`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "OTP sent successfully (TEST MODE)",
          testOTP: otp // Only in test mode
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send real SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", `+66${phone.replace(/^0/, "")}`); // Convert Thai format to international
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", `รหัสยืนยัน OTP ของคุณคือ: ${otp}\n\nRef: RELK\n\nรหัสนี้จะหมดอายุใน 5 นาที`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio error:", errorText);
      
      // Parse error to check if it's a trial account limitation
      try {
        const errorData = JSON.parse(errorText);
        const isTrialError = errorData.code === 21608 || errorData.code === 21659;
        
        if (isTrialError) {
          console.log(`⚠️ Twilio Trial Account Limitation (Code: ${errorData.code})`);
          console.log(`📱 To send real SMS: Verify this number at https://console.twilio.com/us1/develop/phone-numbers/manage/verified or upgrade your Twilio account`);
        }
      } catch (e) {
        // Error parsing, continue with fallback
      }
      
      // Fallback to test mode on any Twilio error
      console.log(`✅ TEST MODE ACTIVE - OTP: ${otp}`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "OTP generated (test mode)",
          testOTP: otp
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const twilioData = await twilioResponse.json();
    console.log("SMS sent successfully via Twilio:", twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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

// Export OTP store for verify function
export { otpStore };
