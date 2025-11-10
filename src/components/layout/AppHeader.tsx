import { useState } from "react";
import { Bell, Power } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
export function AppHeader({
  userName,
  profilePhoto,
  onSignOut,
  showQuickMenu = false
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  
  const getDayName = () => {
    const dayKeys = ['home.sunday', 'home.monday', 'home.tuesday', 'home.wednesday', 'home.thursday', 'home.friday', 'home.saturday'];
    return t(dayKeys[new Date().getDay()]);
  };
  return <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-b-3xl shadow-lg overflow-hidden">
      <div className="relative overflow-hidden h-20">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
        backgroundImage: `url(${coverHeader})`
      }} />
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-white/20" key={profilePhoto}>
                <AvatarImage src={profilePhoto} alt={userName} />
                <AvatarFallback className="bg-white/20 text-white text-lg">
                  {userName?.charAt(0) || "👤"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-fit h-14 rounded-xl bg-slate-100 px-3 py-2">
                <div className="text-sm opacity-90 text-[#126D8A] whitespace-nowrap">{t('home.greeting')} {getDayName()}</div>
                <div className="font-semibold text-[#153860] whitespace-nowrap">{userName || t('settings.title')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/notifications")} className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
                <Bell className="w-5 h-5 text-[#153860]" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button onClick={() => setShowSignOutDialog(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Power className="w-5 h-5 text-[#153860]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQuickMenu && <div className="px-4 pb-2" style={{
      background: "linear-gradient(180deg, #F5FAFF 74.22%, #E1EBF7 100%)"
    }}>
          <div className="grid grid-cols-4 gap-3 p-4">
            {/* Quick menu section with its own padding */}
            {[{
          icon: currentJobIcon,
          labelKey: "home.current_jobs",
          path: "/current-jobs"
        }, {
          icon: biddingIcon,
          labelKey: "home.bidding",
          path: "/bidding"
        }, {
          icon: incomeIcon,
          labelKey: "home.income",
          path: "/income"
        }, {
          icon: jobHistoryIcon,
          labelKey: "home.job_history",
          path: "/job-history"
        }].map(item => <button key={item.labelKey} onClick={() => item.path && navigate(item.path)} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img src={item.icon} alt={t(item.labelKey)} className="w-full h-full object-contain" />
                </div>
                <span className="text-xs text-[#153860] text-center">{t(item.labelKey)}</span>
              </button>)}
          </div>
        </div>}

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="max-w-[320px] w-[90%] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl">
          <AlertDialogHeader className="items-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <Power className="w-8 h-8 text-slate-600" />
            </div>
            <AlertDialogTitle className="text-center text-base">
              {t('home.sign_out_confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              {t('home.sign_out_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={() => {
                setShowSignOutDialog(false);
                onSignOut?.();
              }}
              className="flex-1 m-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('home.sign_out_btn')}
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 m-0">{t('home.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>;
}