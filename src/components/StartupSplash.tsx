import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import truckerIcon from "@/assets/trucker-icon.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { preloadAllTabs } from "@/lib/tabPreload";

const DISPLAY_DURATION_MS = 3000;
const EXIT_DURATION_MS = 300;

export function StartupSplash() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => preloadAllTabs(), 0);
    const exitTimer = window.setTimeout(() => setIsExiting(true), DISPLAY_DURATION_MS);
    const removeTimer = window.setTimeout(
      () => setIsVisible(false),
      DISPLAY_DURATION_MS + EXIT_DURATION_MS,
    );

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
      aria-label={t("common.loading")}
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center bg-background transition-opacity duration-300 motion-reduce:transition-none ${
        isExiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6 px-6">
        <div className="h-36 w-36 overflow-hidden rounded-lg bg-card shadow-lg sm:h-40 sm:w-40">
          <img
            src={truckerIcon}
            alt="The Truckers"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                style={{ animationDelay: `${index * 180}ms` }}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}