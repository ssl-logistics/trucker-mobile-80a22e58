import { useNavigate, useLocation } from "react-router-dom";
import { Home, LayoutGrid, Phone, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCall } from "@/components/call/CallProvider";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import HomeIcon from "@/assets/home-icon.svg";
import HomeIconActive from "@/assets/home-icon-active.svg";
import DashboardIcon from "@/assets/dashboard-icon.svg";
import DashboardIconActive from "@/assets/dashboard-icon-active.svg";
import SettingsIcon from "@/assets/settings-icon.svg";
import SettingsIconActive from "@/assets/settings-icon-active.svg";

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { canAccessDashboard } = useUserRole();
  const { callState } = useCall();
  const [mounted, setMounted] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    {
      icon: Home,
      label: t("nav.home"),
      path: "/home",
      customIcon: HomeIcon,
      customActiveIcon: HomeIconActive,
    },
    {
      icon: LayoutGrid,
      label: t("nav.dashboard"),
      path: "/dashboard",
      customIcon: DashboardIcon,
      customActiveIcon: DashboardIconActive,
      showForFreelanceOnly: true,
    },
    {
      icon: Phone,
      label: t("nav.chat"),
      path: "/chat",
    },
    {
      icon: Settings,
      label: t("nav.settings"),
      path: "/settings",
      customIcon: SettingsIcon,
      customActiveIcon: SettingsIconActive,
    },
  ].filter((item) => !item.showForFreelanceOnly || canAccessDashboard);

  // Expose bottom navigation height to the scroll container so content can scroll above it.
  // This prevents the last part of the page from being hidden behind the fixed nav.
  useEffect(() => {
    if (!mounted) return;

    const el = navRef.current;
    if (!el) return;

    const setVar = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--bottom-nav-height", `${height}px`);
    };

    setVar();

    const ro = "ResizeObserver" in window ? new ResizeObserver(setVar) : null;
    ro?.observe(el);

    window.addEventListener("resize", setVar);
    window.visualViewport?.addEventListener("resize", setVar);

    return () => {
      window.removeEventListener("resize", setVar);
      window.visualViewport?.removeEventListener("resize", setVar);
      ro?.disconnect();
      document.documentElement.style.setProperty("--bottom-nav-height", "0px");
    };
  }, [mounted, navItems.length]);
  
  const navContent = (
    <nav
      id="bottom-navigation"
      ref={navRef}
      data-tour="bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        backgroundColor: "#153860",
        padding: "8px 16px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        borderTopLeftRadius: "16px",
        borderTopRightRadius: "16px",
        transform: "translate3d(0, 0, 0)",
        WebkitTransform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        willChange: "transform",
        isolation: "isolate",
      }}
    >
      <div style={{ 
        display: "flex", 
        justifyContent: "space-around", 
        alignItems: "center", 
        maxWidth: "24rem", 
        margin: "0 auto" 
      }}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            data-tour={item.path === "/dashboard" ? "dashboard-nav" : item.path === "/chat" ? "chat-nav" : item.path === "/settings" ? "settings-nav" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "12px",
                background: isActive(item.path) 
                  ? "linear-gradient(135deg, #00D4AA 0%, #00B4E6 100%)" 
                  : "transparent",
              }}
            >
              {item.customIcon ? (
                <img 
                  src={isActive(item.path) && item.customActiveIcon ? item.customActiveIcon : item.customIcon} 
                  alt={item.label}
                  style={{
                    width: "20px",
                    height: "20px",
                    filter: isActive(item.path) 
                      ? "brightness(0) saturate(100%) invert(100%)" 
                      : "brightness(0) saturate(100%) invert(90%) sepia(10%) saturate(200%) hue-rotate(180deg)",
                  }}
                />
              ) : (
                <item.icon 
                  style={{ 
                    width: "20px", 
                    height: "20px", 
                    color: isActive(item.path) ? "#ffffff" : "#a8c5e0",
                  }} 
                />
              )}
            </div>
            <span 
              style={{ 
                fontSize: "12px", 
                fontWeight: isActive(item.path) ? "600" : "500",
                color: isActive(item.path) ? "#ffffff" : "#a8c5e0",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
  
  if (!mounted) return null;
  
  // Hide nav bar during active calls
  if (callState !== 'idle') return null;
  
  return createPortal(navContent, document.body);
}
