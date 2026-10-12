import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import truckerIcon from "@/assets/trucker-icon.png";
import { preloadAllTabs } from "@/lib/tabPreload";

const DISPLAY_DURATION_MS = 3000;
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
            src={truckerIcon}
            alt="The Truckers"
            className="h-36 w-36 object-contain sm:h-40 sm:w-40"
            draggable={false}
          />
        </div>

        {/* Brand-colored spinner ring */}
        <div
          aria-hidden="true"
          className="splash-ring relative h-10 w-10"
        >
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin motion-reduce:animate-none [animation-duration:1.1s]" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
