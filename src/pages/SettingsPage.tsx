import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, User, Truck, Bell, Globe, Info, HelpCircle, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { toast } from '@/hooks/use-toast';
import {
  isPushSupported,
  isPushEnabled,
  enablePushNotifications,
  disablePushNotifications,
  getPlatformName,
} from '@/utils/unifiedPushNotifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, setAuthTransitioning } = useAuth();
  const { t } = useLanguage();
  const { vehiclePhoto } = useVehiclePhoto();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  useEffect(() => {
    if (user) {
      checkNotificationStatus();
    }
  }, [user]);

  const checkNotificationStatus = async () => {
    try {
      const isSubscribed = await isPushEnabled();
      setNotificationsEnabled(isSubscribed);
    } catch (error) {
      console.error('Failed to check notification status:', error);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    setIsNotificationLoading(true);
    
    try {
      if (enabled) {
        // Check if notifications are supported
        if (!isPushSupported()) {
          toast({
            title: t('toast.notSupported'),
            description: t('toast.browserNotSupported'),
            variant: "destructive",
          });
          return;
        }

        const success = await enablePushNotifications();
        
        if (success) {
          setNotificationsEnabled(true);
          toast({
            title: t('toast.notificationEnabled'),
            description: t('toast.notificationEnabledDesc'),
          });
        } else {
          const platform = getPlatformName();
          toast({
            title: t('toast.cannotEnableNotification'),
            description: platform === 'Web' 
              ? t('toast.allowNotificationInBrowser')
              : `Please enable notifications in your ${platform} settings`,
            variant: "destructive",
          });
        }
      } else {
        // Unsubscribe from push notifications
        await disablePushNotifications();
        setNotificationsEnabled(false);
        
        toast({
          title: t('toast.notificationDisabled'),
          description: t('toast.notificationDisabledDesc'),
        });
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.cannotChangeSettings'),
        variant: "destructive",
      });
    } finally {
      setIsNotificationLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthTransitioning(true, 'กำลังออกจากระบบ...');
    try {
      const driverId = user?.id || localStorage.getItem('auth_driver_id');
      
      if (driverId) {
        await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
          body: JSON.stringify({ driver_id: driverId }),
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      logout();
      toast({
        description: t('settings.logoutSuccess') || 'ออกจากระบบสำเร็จ',
      });
      setTimeout(() => {
        setAuthTransitioning(false);
        navigate('/');
      }, 500);
    }
  };

  // Get vehicle info from user data
  const vehiclePlate = user?.plate_number && user?.plate_province 
    ? `${user.plate_number} ${user.plate_province}` 
    : user?.plate_number || '';
  const vehicleBrand = user?.vehicle_brand || '';

  const menuItems = [
    {
      section: t('settings.personal_info'),
      items: [
        { icon: User, label: t('settings.account'), path: '/account' },
        { 
          icon: Truck, 
          label: t('settings.vehicle_info'), 
          path: '/vehicle-info',
          subtitle: vehiclePlate || vehicleBrand ? `${vehicleBrand} ${vehiclePlate}`.trim() : undefined
        },
      ]
    },
    {
      section: t('settings.general'),
      items: [
        { icon: Bell, label: t('settings.notifications'), hasToggle: true },
      ]
    },
    {
      section: t('settings.about'),
      items: [
        { icon: Globe, label: t('settings.language'), path: '/language' },
        { icon: Info, label: t('settings.terms'), path: '/terms' },
        { icon: HelpCircle, label: t('settings.contact'), path: '/contact' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground text-center page-header-safe">
        <h1 className="text-xl font-semibold px-4 py-4">{t('settings.title')}</h1>
      </header>

      {/* Profile Section */}
      <div className="bg-white p-4 mb-2">
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage 
                src={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined} 
                alt={`${user?.first_name || ''} ${user?.last_name || ''}`} 
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.first_name?.charAt(0) || user?.full_name?.charAt(0) || "👤"}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-foreground">
              {user?.first_name && user?.last_name 
                ? `${user.first_name} ${user.last_name}` 
                : user?.full_name || t('settings.profile')}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Menu Sections */}
      {menuItems.map((section, idx) => (
        <div key={idx} className="bg-white mb-2">
          <div className="px-4 py-2">
            <h2 className="text-sm text-muted-foreground">{section.section}</h2>
          </div>
          <div className="divide-y">
            {section.items.map((item, itemIdx) => (
              <div key={itemIdx}>
                {item.hasToggle ? (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-foreground" />
                      <span className="text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600">
                        {notificationsEnabled ? t('settings.notifications_enabled') : t('settings.notifications_disabled')}
                      </span>
                      <Switch 
                        checked={notificationsEnabled}
                        onCheckedChange={handleNotificationToggle}
                        disabled={isNotificationLoading}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => item.path && navigate(item.path)}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-foreground" />
                      <div className="flex flex-col items-start">
                        <span className="text-foreground">{item.label}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Sign Out Button */}
      <div className="px-4 mt-6">
        <Button
          onClick={() => setShowSignOutDialog(true)}
          variant="outline"
          className="w-full border-destructive text-destructive hover:bg-destructive/10"
        >
          {t('settings.sign_out')}
        </Button>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="max-w-[320px] w-[90%] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl">
          <AlertDialogHeader className="items-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <Power className="w-8 h-8 text-slate-600" />
            </div>
            <AlertDialogTitle className="text-center text-base">
              {t('settings.sign_out_confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              {t('settings.sign_out_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={handleSignOut}
              className="flex-1 m-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('settings.sign_out')}
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 m-0">{t('settings.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNavigation />
    </div>
  );
}
