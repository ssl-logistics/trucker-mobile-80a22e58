const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PhotoPayload {
  data: string;
  content_type: string;
  file_name: string;
}

// 20 MB per file (base64 inflates ~33%, so allow ~27 MB in the payload field)
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_B64_LEN = Math.ceil((MAX_FILE_BYTES / 3) * 4) + 200;
const MAX_FILES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { license_plate, driver_id, driver_type, driver_name, note, latitude, longitude, photos_base64 } = body ?? {};

    if (!license_plate || typeof license_plate !== "string" || license_plate.trim().length > 50) {
      return new Response(JSON.stringify({ error: "license_plate is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!driver_id || typeof driver_id !== "string") {
      return new Response(JSON.stringify({ error: "driver_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["internal", "external", "freelance"].includes(driver_type)) {
      return new Response(JSON.stringify({ error: "driver_type must be internal, external or freelance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const photos: PhotoPayload[] = Array.isArray(photos_base64) ? photos_base64.slice(0, MAX_FILES) : [];
    for (const p of photos) {
      if (
        !p || typeof p.data !== "string" || p.data.length > MAX_FILE_B64_LEN ||
        typeof p.content_type !== "string" || !/^(image|video)\//.test(p.content_type) ||
        typeof p.file_name !== "string"
      ) {
        return new Response(JSON.stringify({ error: "Invalid photos_base64 entry" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const externalUrl = "https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/report-vehicle-maintenance";
    const apiKey = Deno.env.get("EXPRESS_RENT_API_KEY");

    if (!apiKey) {
      throw new Error("EXPRESS_RENT_API_KEY is not configured");
    }

    const payload = {
      license_plate: license_plate.trim(),
      driver_id,
      driver_type,
      driver_name: typeof driver_name === "string" && driver_name.trim() ? driver_name.trim() : null,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      photos_base64: photos.length > 0 ? photos : null,
    };

    const externalResponse = await fetch(externalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await externalResponse.text();

    if (!externalResponse.ok) {
      console.error("External API error:", externalResponse.status, responseData);
      return new Response(
        JSON.stringify({ success: false, error: responseData || "External API error", status: externalResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
