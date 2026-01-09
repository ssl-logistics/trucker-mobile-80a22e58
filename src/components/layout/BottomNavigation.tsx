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
      className="animate-fade-in"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: "linear-gradient(135deg, #0f2847 0%, #1a4a7a 50%, #0f2847 100%)",
        padding: "16px 20px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        boxShadow: "0 -8px 32px -4px rgba(15, 40, 71, 0.4)",
        borderTopLeftRadius: "24px",
        borderTopRightRadius: "24px",
        backdropFilter: "blur(12px)",
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
        maxWidth: "28rem", 
        margin: "0 auto" 
      }}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="hover-scale"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                padding: "10px 20px",
                borderRadius: "16px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background: isActive(item.path) 
                  ? "linear-gradient(135deg, #00D4AA 0%, #00B4E6 100%)" 
                  : "rgba(255, 255, 255, 0.08)",
                boxShadow: isActive(item.path) 
                  ? "0 4px 20px rgba(0, 212, 170, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)" 
                  : "none",
                transform: isActive(item.path) ? "scale(1.05)" : "scale(1)",
              }}
            >
              {item.customIcon ? (
                <img 
                  src={isActive(item.path) && item.customActiveIcon ? item.customActiveIcon : item.customIcon} 
                  alt={item.label}
                  style={{
                    width: "22px",
                    height: "22px",
                    filter: isActive(item.path) 
                      ? "brightness(0) saturate(100%) invert(100%)" 
                      : "brightness(0) saturate(100%) invert(90%) sepia(10%) saturate(200%) hue-rotate(180deg)",
                    transition: "all 0.3s ease",
                  }}
                />
              ) : (
                <item.icon 
                  style={{ 
                    width: "22px", 
                    height: "22px", 
                    color: isActive(item.path) ? "#ffffff" : "#a8c5e0",
                    transition: "all 0.3s ease",
                  }} 
                />
              )}
            </div>
            <span 
              style={{ 
                fontSize: "11px", 
                fontWeight: isActive(item.path) ? "600" : "500",
                color: isActive(item.path) ? "#ffffff" : "#a8c5e0",
                letterSpacing: "0.02em",
                transition: "all 0.3s ease",
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
  
  return createPortal(navContent, document.body);
}
