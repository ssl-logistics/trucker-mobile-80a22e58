// Shared audit-log helper for edge functions.
// Fire-and-forget insert into public.edge_function_audit_logs via service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuditLogEntry {
  function_name: string;
  driver_id?: string | null;
  order_number?: string | null;
  room_code?: string | null;
  request_payload?: unknown;
  external_request_payload?: unknown;
  response_status?: number | null;
  response_body?: unknown;
  success?: boolean;
  error_message?: string | null;
  duration_ms?: number | null;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.warn("[audit] Missing SUPABASE env vars, skipping audit log");
      return;
    }
    const supabase = createClient(url, key);
    const { error } = await supabase.from("edge_function_audit_logs").insert({
      function_name: entry.function_name,
      driver_id: entry.driver_id ?? null,
      order_number: entry.order_number ?? null,
      room_code: entry.room_code ?? null,
      request_payload: entry.request_payload ?? null,
      external_request_payload: entry.external_request_payload ?? null,
      response_status: entry.response_status ?? null,
      response_body: entry.response_body ?? null,
      success: entry.success ?? null,
      error_message: entry.error_message ?? null,
      duration_ms: entry.duration_ms ?? null,
    });
    if (error) {
      console.warn("[audit] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[audit] exception:", e instanceof Error ? e.message : String(e));
  }
}
