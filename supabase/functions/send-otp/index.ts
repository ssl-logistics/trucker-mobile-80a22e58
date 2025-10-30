import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

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

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", `+66${phone.replace(/^0/, "")}`); // Convert Thai format to international
    formData.append("From", TWILIO_PHONE_NUMBER!);
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
      const error = await twilioResponse.text();
      console.error("Twilio error:", error);
      throw new Error("Failed to send SMS");
    }

    const twilioData = await twilioResponse.json();
    console.log("SMS sent successfully:", twilioData.sid);

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
