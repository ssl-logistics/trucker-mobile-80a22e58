import { useNavigate, useLocation } from "react-router-dom";
import { Home, LayoutGrid, MessageCircle, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const isActive = (path: string) => location.pathname === path;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 text-white px-6 py-3 shadow-lg"
      style={{
        backgroundColor: "#153860",
      }}
    >
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {[
          {
            icon: Home,
            label: t("nav.home"),
            path: "/home",
          },
          {
            icon: LayoutGrid,
            label: t("nav.dashboard"),
            path: "/dashboard",
          },
          {
            icon: MessageCircle,
            label: t("nav.chat"),
            path: "/chat",
          },
          {
            icon: Settings,
            label: t("nav.settings"),
            path: "/settings",
          },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-1 transition-colors"
          >
            <div
              className={`rounded-2xl transition-all ${
                isActive(item.path) ? "bg-gradient-to-r from-[#00C188] to-[#23B9E9]" : ""
              }`}
            >
              <item.icon className="w-6 h-6 text-[#E0FFEA]" />
            </div>
            <span className="text-xs text-[#E2F8FF]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
