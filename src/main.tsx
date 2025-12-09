import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force reload when new content is available
    if (confirm('New version available! Click OK to update')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegisteredSW(swUrl, r) {
    // Check for updates every hour
    r && setInterval(() => {
      r.update();
    }, 60 * 60 * 1000);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
