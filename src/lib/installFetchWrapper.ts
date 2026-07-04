// Installs a window.fetch wrapper that attaches the shared app-secret header
// to requests targeting our own Supabase edge functions.
//
// CRITICAL: this file must be imported BEFORE any @supabase/supabase-js
// module (which captures `fetch` at module init inside functions-js).
// Otherwise supabase.functions.invoke() bypasses this wrapper and edge
// functions that verify x-app-secret return 401.
(function installEdgeFunctionAuthHeader() {
  if (typeof window === "undefined") return;
  const APP_SECRET = import.meta.env.VITE_APP_EDGE_SHARED_SECRET as string | undefined;
  const OWN_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!APP_SECRET || !OWN_SUPABASE_URL) return;
  const ownFunctionsPrefix = `${OWN_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/`;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
      if (url.startsWith(ownFunctionsPrefix)) {
        const headers = new Headers(
          init?.headers ||
            (typeof input !== "string" && !(input instanceof URL)
              ? (input as Request).headers
              : undefined),
        );
        if (!headers.has("x-app-secret")) headers.set("x-app-secret", APP_SECRET);
        return originalFetch(input, { ...(init || {}), headers });
      }
    } catch {
      // fall through
    }
    return originalFetch(input, init);
  };
})();

export {};
