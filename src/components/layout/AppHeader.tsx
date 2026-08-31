import { useState } from "react";
import { Bell, Power, Loader2, Building2, Factory, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePresignedImageUrl } from "@/hooks/usePresignedImageUrl";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import coverHeader from "@/assets/cover-header.png";
import currentJobIcon from "@/assets/current-job-icon.svg";
import biddingIcon from "@/assets/bidding-icon.svg";
import incomeIcon from "@/assets/income-icon.svg";
import jobHistoryIcon from "@/assets/job-history-icon.svg";
import marketIcon from "@/assets/market-icon.png";
interface AppHeaderProps {
  userName?: string;
  profilePhoto?: string;
  onSignOut?: () => Promise<void> | void;
  showQuickMenu?: boolean;
}
export function AppHeader({
  userName,
  profilePhoto,
  onSignOut,
  showQuickMenu = false
}: AppHeaderProps) {
  const navigate = useNavigate();
  const {
    t
  } = useLanguage();
  const {
    canAccessBidding,
    userType,
    employerType,
    isInternalDriver,
    isExternalDriver,
    isFreelanceDriver
  } = useUserRole();

  // Get user type label and icon based on employer_type for internal/external drivers
  const getUserTypeInfo = () => {
    if (isInternalDriver) {
      // For internal drivers, show based on employer_type (mapped from company_type)
      if (employerType === 'factory') {
        return { label: t('home.factory_employee'), icon: Factory, color: 'bg-purple-500' };
      } else if (employerType === 'company') {
        return { label: t('home.company_employee'), icon: Building2, color: 'bg-blue-500' };
      } else if (employerType === 'subcontractor') {
        return { label: t('home.subcontractor_employee'), icon: Truck, color: 'bg-teal-500' };
      }
      // Default fallback
      return { label: t('home.internal_driver'), icon: Factory, color: 'bg-purple-500' };
    }
    if (isExternalDriver) {
      // For external drivers, show based on employer_type (mapped from company_type)
      if (employerType === 'factory') {
        return { label: t('home.factory_contractor'), icon: Factory, color: 'bg-orange-500' };
      } else if (employerType === 'company') {
        return { label: t('home.company_contractor'), icon: Building2, color: 'bg-amber-500' };
      } else if (employerType === 'subcontractor') {
        return { label: t('home.subcontractor_employee'), icon: Truck, color: 'bg-teal-500' };
      }
      // Default fallback
      return { label: t('home.external_driver'), icon: Building2, color: 'bg-orange-500' };
    }
    if (isFreelanceDriver) {
      return { label: t('home.freelance_driver'), icon: Truck, color: 'bg-red-500' };
    }
    return null;
  };

  const userTypeInfo = getUserTypeInfo();
  
  // Get presigned URL for S3 profile photos
  const { url: presignedProfilePhoto, isLoading: isPhotoLoading } = usePresignedImageUrl(profilePhoto);
  
  // Check for unread notifications
  const { hasUnread } = useUnreadNotifications();
  
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const getDayName = () => {
    const dayKeys = ['home.sunday', 'home.monday', 'home.tuesday', 'home.wednesday', 'home.thursday', 'home.friday', 'home.saturday'];
    return t(dayKeys[new Date().getDay()]);
  };
  return <header className="app-header-fixed bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg overflow-hidden">
      <div data-tour="header" className="relative overflow-hidden" style={{
      paddingTop: "env(safe-area-inset-top, 0px)"
    }}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
        backgroundImage: `url(${coverHeader})`
      }} />
        {/* Content */}
        <div className="relative z-10 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[10px]">
              <Avatar className="w-10 h-10 border-2 border-white/20">
                {isPhotoLoading ? (
                  <AvatarFallback className="bg-white/20 text-white text-base">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={presignedProfilePhoto || undefined} alt={userName} key={presignedProfilePhoto} />
                    <AvatarFallback className="bg-white/20 text-white text-base">
                      {userName?.charAt(0) || "👤"}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="min-w-0 flex-1 h-auto min-h-[44px] rounded-xl bg-slate-100 px-3 py-1.5 overflow-hidden flex flex-col justify-center">
                <div className="text-xs opacity-90 text-[#126D8A] truncate">{t('home.greeting')} {getDayName()}</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm text-[#153860] leading-tight break-words line-clamp-2">{userName || t('settings.title')}</span>
                  {userTypeInfo && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white w-fit ${userTypeInfo.color}`}>
                      <userTypeInfo.icon className="w-2.5 h-2.5" />
                      {userTypeInfo.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              <button onClick={() => navigate("/notifications")} className="relative p-1 hover:bg-white/10 rounded-full transition-colors">
                <Bell className="w-4 h-4 text-[#153860]" />
                {hasUnread && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                )}
              </button>
              <button onClick={() => setShowSignOutDialog(true)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <Power className="w-4 h-4 text-[#153860]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQuickMenu && <div className="pb-2" style={{
      background: "linear-gradient(180deg, #F5FAFF 74.22%, #E1EBF7 100%)"
    }}>
          <div className="flex justify-evenly px-4 py-4">
            {/* Quick menu section with its own padding */}
            {[{
          icon: currentJobIcon,
          labelKey: "home.current_jobs",
          path: "/current-jobs"
        },
        // ปิดเมนู "เสนอราคา" ไว้ก่อน (route /bidding ยังใช้งานได้)
        // {
        //   icon: biddingIcon,
        //   labelKey: "home.bidding",
        //   path: "/bidding",
        //   showForFreelanceOnly: true
        // },
        {
          icon: marketIcon,
          labelKey: "home.market",
          path: "/market",
          showForFreelanceOnly: true
        }, {
          icon: incomeIcon,
          labelKey: "home.income",
          path: "/income",
          showForFreelanceOnly: true
        }, {
          icon: jobHistoryIcon,
          labelKey: "home.job_history",
          path: "/job-history"
        }].filter(item => !item.showForFreelanceOnly || canAccessBidding).map(item => <button 
          key={item.labelKey} 
          onClick={() => item.path && navigate(item.path)} 
          className="flex flex-col items-center gap-2"
          data-tour={item.labelKey === "home.market" ? "bidding-menu" : item.labelKey === "home.current_jobs" ? "current-jobs-menu" : undefined}
        >
                <div className="w-16 h-16 flex items-center justify-center">
                  <img src={item.icon} alt={t(item.labelKey)} className="w-full h-full object-contain" />
                </div>
                <span className="text-sm text-[#153860] text-center">{t(item.labelKey)}</span>
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
              onClick={async () => {
                if (isLoggingOut) return;
                setIsLoggingOut(true);
                await onSignOut?.();
              }} 
              disabled={isLoggingOut}
              className="flex-1 m-0 !bg-red-500 !text-white hover:!bg-red-600 disabled:!bg-red-500 disabled:!text-white"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังออก...
                </>
              ) : (
                t('home.sign_out_btn')
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isLoggingOut} className="flex-1 m-0">{t('home.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>;
}