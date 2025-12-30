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
  
  const navContent = (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        backgroundColor: "#153860",
        padding: "12px 24px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {[
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
        ]
        .filter((item) => !item.showForFreelanceOnly || isFreelance)
        .map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 transition-colors"
          >
            <div
              className={`p-1 px-4 rounded-full transition-all ${
                isActive(item.path) ? "bg-gradient-to-r from-[#00C188] to-[#23B9E9]" : ""
              }`}
            >
              {item.customIcon ? (
                <img 
                  src={isActive(item.path) && item.customActiveIcon ? item.customActiveIcon : item.customIcon} 
                  alt={item.label}
                  className="w-6 h-6"
                  style={{ filter: 'brightness(0) saturate(100%) invert(93%) sepia(8%) saturate(437%) hue-rotate(83deg) brightness(103%) contrast(101%)' }}
                />
              ) : (
                <item.icon className="w-6 h-6 text-[#E0FFEA]" />
              )}
            </div>
            <span className="text-xs text-[#E2F8FF]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
  
  if (!mounted) return null;
  
  return createPortal(navContent, document.body);
}
