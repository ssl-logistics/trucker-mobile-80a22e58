import { Bell, Power } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import coverHeader from "@/assets/cover-header.png";
import currentJobIcon from "@/assets/current-job-icon.svg";
import biddingIcon from "@/assets/bidding-icon.svg";
import incomeIcon from "@/assets/income-icon.svg";
import jobHistoryIcon from "@/assets/job-history-icon.svg";
interface AppHeaderProps {
  userName?: string;
  profilePhoto?: string;
  onSignOut?: () => void;
  showQuickMenu?: boolean;
}
export function AppHeader({ userName, profilePhoto, onSignOut, showQuickMenu = false }: AppHeaderProps) {
  const navigate = useNavigate();
  const getDayName = () => {
    const days = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
    return days[new Date().getDay()];
  };
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-b-3xl shadow-lg overflow-hidden">
      <div className="relative overflow-hidden h-20">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${coverHeader})`,
          }}
        />
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-white/20">
                <AvatarImage src={profilePhoto} alt={userName} />
                <AvatarFallback className="bg-white/20 text-white text-lg">
                  {userName?.charAt(0) || "👤"}
                </AvatarFallback>
              </Avatar>
              <div className="bg-[#FFFFFF4D] h-6 w-12">
                <div className="text-sm opacity-90 text-[#126D8A]">👋 {getDayName()}</div>
                <div className="font-semibold text-[#153860]">{userName || "คุณผู้ใช้งาน"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/notifications")}
                className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5 text-[#153860]" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button onClick={onSignOut} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Power className="w-5 h-5 text-[#153860]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQuickMenu && (
        <div
          className="px-4 pb-2"
          style={{
            background: "linear-gradient(180deg, #F5FAFF 74.22%, #E1EBF7 100%)",
          }}
        >
          <div className="grid grid-cols-4 gap-3 p-4">
            {/* Quick menu section with its own padding */}
            {[
              {
                icon: currentJobIcon,
                label: "งานปัจจุบัน",
                path: "/current-jobs",
              },
              {
                icon: biddingIcon,
                label: "เสนอราคา",
                path: "/bidding",
              },
              {
                icon: incomeIcon,
                label: "รายได้",
                path: "/income",
              },
              {
                icon: jobHistoryIcon,
                label: "ประวัติงาน",
                path: "/job-history",
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  <img src={item.icon} alt={item.label} className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-[#153860] text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
