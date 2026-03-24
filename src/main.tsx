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
  const hash = window.location.hash;
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
