// Shared app-secret verification for edge functions.
// Blocks unauthenticated internet callers by requiring the mobile
// app's bundled shared secret header (set by src/main.tsx fetch wrapper).
export function verifyAppSecret(req: Request): Response | null {
  const expected = Deno.env.get("APP_EDGE_SHARED_SECRET");
  if (!expected) {
    // If the secret is not configured on the server, fail closed.
    return new Response(JSON.stringify({ error: "Server auth not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-app-secret");
  if (!provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
