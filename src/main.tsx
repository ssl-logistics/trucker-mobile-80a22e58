// MUST be first import: installs a window.fetch wrapper that attaches the
// shared app-secret header. Any supabase-js import below captures `fetch` at
// module init inside functions-js, so this wrapper must exist beforehand.
import "./lib/installFetchWrapper";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { supabase } from "./integrations/supabase/client";


// Intercept OAuth tokens from URL hash before HashRouter consumes them.
// After Apple OAuth redirect, tokens may appear as:
//   /#access_token=...&refresh_token=...&token_type=bearer...
// HashRouter would interpret this as a route path → 404.
(function handleOAuthTokensInHash() {
  const pathname = window.location.pathname;
  const search = window.location.search || '';
  const hash = window.location.hash || '';

  // If Apple OAuth callback lands on SPA path (without static callback file),
  // immediately forward to the static callback page that deep-links back to iOS app.
  if (pathname === '/auth/apple/callback' || pathname === '/auth/apple/callback/') {
    const target = `/auth/apple/callback/index.html${search}${hash}`;
    window.location.replace(target);
    return;
  }

  // ⚡ LINE OAuth: LINE Console requires redirect_uri without `index.html` suffix,
  // but Lovable SPA hosting serves index.html for /auth/line/callback.
  // Forward to the real static file so the deep-link intent logic runs.
  if (
    (pathname === '/auth/line/callback' || pathname === '/auth/line/callback/') &&
    search.includes('code=')
  ) {
    console.log('[OAuth Recovery] LINE callback → forwarding to static file');
    window.location.replace(`/auth/line/callback/index.html${search}`);
    return;
  }

  if (!hash) return;

  // Strip the leading "#" (or "#/" if present)
  const raw = hash.startsWith('#/') ? hash.substring(2) : hash.substring(1);

  // Quick check: does it look like OAuth tokens?
  if (!raw.includes('access_token=')) return;

  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken) {
    console.log('[OAuth Recovery] Detected tokens in hash, setting session...');
    // Clean the hash immediately so HashRouter sees "/"
    window.history.replaceState(null, '', window.location.pathname);

    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    }).then(({ error }) => {
      if (error) {
        console.error('[OAuth Recovery] setSession error:', error);
      } else {
        console.log('[OAuth Recovery] Session set successfully');
        window.dispatchEvent(new Event('auth_driver_updated'));
      }
    });
  }
})();

// In development, ensure no stale PWA service worker is controlling the page
// (can cause cached, outdated bundles and confusing runtime errors).
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Register service worker only in production
if (import.meta.env.PROD) {
  let updateSW: ((reloadPage?: boolean) => void) | undefined;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Force reload when new content is available
      if (confirm("New version available! Click OK to update")) {
        updateSW?.(true);
      }
    },
    onOfflineReady() {
      console.log("App ready to work offline");
    },
    onRegisteredSW(_swUrl, r) {
      // Check for updates every hour
      r &&
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
