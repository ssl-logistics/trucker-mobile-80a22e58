import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAppSecret } from "../_shared/appAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authError = verifyAppSecret(req);
  if (authError) {
    return new Response(await authError.text(), { status: authError.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      throw new Error("Google Maps API key not configured");
    }

    return new Response(
      JSON.stringify({ apiKey }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
