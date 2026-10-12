import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SPLASH_LOGO_DATA_URI } from "@/assets/splashLogo";
import { preloadAllTabs } from "@/lib/tabPreload";

const DISPLAY_DURATION_MS = 4000;
const EXIT_DURATION_MS = 300;

export function StartupSplash() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useLayoutEffect(() => {
    document.body.classList.add("startup-splash-active");
    return () => document.body.classList.remove("startup-splash-active");
  }, []);

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => preloadAllTabs(), 0);
    const exitTimer = window.setTimeout(() => setIsExiting(true), DISPLAY_DURATION_MS);
    const removeTimer = window.setTimeout(() => {
      document.body.classList.remove("startup-splash-active");
      setIsVisible(false);
    }, DISPLAY_DURATION_MS + EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(preloadTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden bg-background transition-opacity duration-300 motion-reduce:transition-none ${
        isExiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Soft ambient glows behind the logo */}
      <div
        aria-hidden="true"
        className="splash-glow pointer-events-none absolute h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="splash-glow pointer-events-none absolute -translate-x-24 translate-y-28 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
        style={{ animationDelay: "-1s" }}
      />

      <div className="relative flex flex-col items-center gap-8 px-6">
        <div className="splash-float relative">
          <img
            src={SPLASH_LOGO_DATA_URI}
            alt="The Truckers"
            className="h-auto w-56 object-contain sm:w-64"
            draggable={false}
          />
        </div>

        {/* Brand-colored spinner ring: thick track + smooth fading arc */}
        <div aria-hidden="true" className="splash-ring relative h-10 w-10">
          <svg viewBox="0 0 40 40" fill="none" className="splash-ring-arc h-10 w-10 motion-reduce:animate-none">
            <defs>
              <linearGradient id="splashArcFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.06 }} />
                <stop offset="45%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.45 }} />
                <stop offset="100%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle
              cx="20"
              cy="20"
              r="16"
              strokeWidth="5"
              style={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.15 }}
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="66 100.6"
              stroke="url(#splashArcFade)"
            />
          </svg>
        </div>
      </div>
    </div>,
    document.body,
  );
}
