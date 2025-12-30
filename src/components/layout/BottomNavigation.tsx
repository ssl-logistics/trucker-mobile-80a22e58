import { useNavigate, useLocation } from "react-router-dom";
import { Home, LayoutGrid, MessageCircle, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import HomeIcon from "@/assets/home-icon.svg";
import HomeIconActive from "@/assets/home-icon-active.svg";
import DashboardIcon from "@/assets/dashboard-icon.svg";
import DashboardIconActive from "@/assets/dashboard-icon-active.svg";
import ChatIcon from "@/assets/chat-icon.svg";
import ChatIconActive from "@/assets/chat-icon-active.svg";
import SettingsIcon from "@/assets/settings-icon.svg";
import SettingsIconActive from "@/assets/settings-icon-active.svg";

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isFreelance } = useUserRole();
  const [mounted, setMounted] = useState(false);
  
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
      icon: MessageCircle,
      label: t("nav.chat"),
      path: "/chat",
      customIcon: ChatIcon,
      customActiveIcon: ChatIconActive,
    },
    {
      icon: Settings,
      label: t("nav.settings"),
      path: "/settings",
      customIcon: SettingsIcon,
      customActiveIcon: SettingsIconActive,
    },
  ].filter((item) => !item.showForFreelanceOnly || isFreelance);
  
  const navContent = (
    <nav
      id="bottom-navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        backgroundColor: "#153860",
        padding: "12px 24px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        willChange: "transform",
      }}
    >
      <div style={{ 
        display: "flex", 
        justifyContent: "space-around", 
        alignItems: "center", 
        maxWidth: "32rem", 
        margin: "0 auto" 
      }}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div
              style={{
                padding: "4px 16px",
                borderRadius: "9999px",
                transition: "all 0.2s",
                background: isActive(item.path) 
                  ? "linear-gradient(to right, #00C188, #23B9E9)" 
                  : "transparent",
              }}
            >
              {item.customIcon ? (
                <img 
                  src={isActive(item.path) && item.customActiveIcon ? item.customActiveIcon : item.customIcon} 
                  alt={item.label}
                  style={{
                    width: "24px",
                    height: "24px",
                    filter: "brightness(0) saturate(100%) invert(93%) sepia(8%) saturate(437%) hue-rotate(83deg) brightness(103%) contrast(101%)",
                  }}
                />
              ) : (
                <item.icon style={{ width: "24px", height: "24px", color: "#E0FFEA" }} />
              )}
            </div>
            <span style={{ fontSize: "12px", color: "#E2F8FF" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
  
  if (!mounted) return null;
  
  return createPortal(navContent, document.body);
}
