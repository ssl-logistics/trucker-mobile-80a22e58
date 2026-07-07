import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-secret",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const vehicleInsertDefaults = (driverId: string) => ({
  driver_id: driverId,
  plate_number: "",
  plate_province: "",
  vehicle_brand: "",
  vehicle_color: "",
  vin: "",
  fuel_type: "",
  load_capacity: 0,
  vehicle_type: "",
  has_trailer: false,
  container_types: [],
  updated_at: new Date().toISOString(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const driverId = url.searchParams.get("driver_id");
      if (!driverId || !UUID_RE.test(driverId)) {
        return json({ error: "driver_id (uuid) is required" }, 400);
      }

      const [{ data: bank }, { data: vehicle }] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("user_id", driverId).maybeSingle(),
        supabase.from("vehicles").select("*").eq("driver_id", driverId).maybeSingle(),
      ]);

      return json({ bank: bank ?? null, vehicle: vehicle ?? null });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const driverId: string | undefined = body?.driver_id;
      if (!driverId || !UUID_RE.test(driverId)) {
        return json({ error: "driver_id (uuid) is required" }, 400);
      }

      const results: Record<string, unknown> = {};

      if (body.bank && typeof body.bank === "object") {
        const b = body.bank as Record<string, string>;
        const row = {
          user_id: driverId,
          bank_name: b.bank_name ?? null,
          account_name: b.account_name ?? null,
          account_number: b.account_number ?? null,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from("bank_accounts")
          .upsert(row, { onConflict: "user_id" })
          .select()
          .maybeSingle();
        if (error) return json({ error: `bank upsert failed: ${error.message}` }, 500);
        results.bank = data;
      }

      if (body.vehicle && typeof body.vehicle === "object") {
        const v = body.vehicle as Record<string, unknown>;
        // Only allowed columns
        const allowed = [
          "plate_number", "plate_province", "vehicle_brand", "vehicle_color",
          "vin", "vehicle_type", "fuel_type", "load_capacity",
          "width", "length", "height", "container_types",
          "has_trailer", "trailer_plate_number", "trailer_plate_province",
        ];
        const row: Record<string, unknown> = { driver_id: driverId, updated_at: new Date().toISOString() };
        for (const key of allowed) {
          if (key in v) row[key] = v[key];
        }

        // Manual upsert since driver_id has no unique constraint guaranteed
        const { data: existing } = await supabase
          .from("vehicles")
          .select("id")
          .eq("driver_id", driverId)
          .maybeSingle();

        let data, error;
        if (existing?.id) {
          ({ data, error } = await supabase
            .from("vehicles")
            .update(row)
            .eq("id", existing.id)
            .select()
            .maybeSingle());
        } else {
          ({ data, error } = await supabase
            .from("vehicles")
            .insert({ ...vehicleInsertDefaults(driverId), ...row })
            .select()
            .maybeSingle());
        }
        if (error) return json({ error: `vehicle upsert failed: ${error.message}` }, 500);
        results.vehicle = data;
      }

      return json({ success: true, ...results });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("[driver-profile-data] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
