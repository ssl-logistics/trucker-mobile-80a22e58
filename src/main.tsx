import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

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
