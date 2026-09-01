import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/test-talad-chat`;

async function callFn(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

Deno.test("pull mode returns a structured result", async () => {
  const { status, json } = await callFn({ mode: "pull", dry_run: true, limit: 5 });
  assertEquals(status, 200);
  assertExists(json);
  assertEquals(json.api_key_configured, true);
  assertExists(json.pull);
  assertEquals(typeof json.pull.status, "number");
});

Deno.test("push mode returns a structured result", async () => {
  const { status, json } = await callFn({ mode: "push", dry_run: true });
  assertEquals(status, 200);
  assertExists(json.push);
  assertEquals(typeof json.push.status, "number");
});

Deno.test("both mode returns pull and push", async () => {
  const { status, json } = await callFn({ mode: "both", dry_run: true, limit: 5 });
  assertEquals(status, 200);
  assertExists(json.pull);
  assertExists(json.push);
  assertEquals(Array.isArray(json.errors), true);
});
