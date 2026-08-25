const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, problem_type, description, screenshot_urls, device_info } = body;
    console.log("[report-app-problem] incoming:", JSON.stringify({ user_id, problem_type, photos: screenshot_urls?.length ?? 0 }));


    if (!problem_type || !description) {
      return new Response(
        JSON.stringify({ error: "problem_type and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalUrl = "https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/report-app-problem";
    const apiKey = Deno.env.get("EXPRESS_RENT_API_KEY");

    if (!apiKey) {
      throw new Error("EXPRESS_RENT_API_KEY is not configured");
    }

    const payload = {
      user_id: user_id || null,
      problem_type,
      description,
      screenshot_urls: screenshot_urls || null,
      device_info: device_info || null,
    };

    console.log("Forwarding report to external API:", JSON.stringify(payload));

    const externalResponse = await fetch(externalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await externalResponse.text();
    console.log("External API response:", externalResponse.status, responseData);

    if (!externalResponse.ok) {
      console.error("External API error:", externalResponse.status, responseData);
      return new Response(
        JSON.stringify({ success: false, error: responseData || "External API error", status: externalResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
