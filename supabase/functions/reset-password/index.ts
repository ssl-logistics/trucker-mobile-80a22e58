import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    // Server-side input validation
    const phoneOk = /^(\+?\d{8,15})$/.test(phone.replace(/[\s-]/g, ""));
    const passwordOk =
      typeof password === "string" &&
      password.length >= 8 &&
      password.length <= 128 &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password);

    if (!phoneOk || !passwordOk) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Invalid input. Phone must be a valid number; password must be 8-128 chars and include letters and digits.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }


    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Normalize phone number for search (handle both 0xx and +66xx formats)
    const normalizedPhone = phone.startsWith('+66') 
      ? '0' + phone.slice(3) 
      : phone.startsWith('66') 
        ? '0' + phone.slice(2) 
        : phone;
    
    const alternativePhone = normalizedPhone.startsWith('0')
      ? '+66' + normalizedPhone.slice(1)
      : normalizedPhone;

    console.log("Searching for phone:", { original: phone, normalized: normalizedPhone, alternative: alternativePhone });

    // Find user by phone number in profiles table (try both formats)
    let profile = null;
    
    // Try normalized format first (0xx)
    const { data: profile1, error: error1 } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .single();
    
    if (profile1) {
      profile = profile1;
    } else {
      // Try alternative format (+66xx)
      const { data: profile2, error: error2 } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone_number', alternativePhone)
        .single();
      
      if (profile2) {
        profile = profile2;
      }
    }

    if (!profile) {
      console.error("User not found with phone:", { normalizedPhone, alternativePhone });
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const userId = profile.id;
    console.log("Found user:", userId);

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update password" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
