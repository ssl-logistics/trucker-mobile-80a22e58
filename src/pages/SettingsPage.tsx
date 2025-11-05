import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, User, Truck, Bell, Globe, Info, HelpCircle, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { toast } from '@/hooks/use-toast';
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

interface Profile {
  full_name: string;
  avatar_url?: string;
  vehicle_photo_url?: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    
    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('id')
      .eq('driver_id', user.id)
      .single();
    
    let vehiclePhotoUrl: string | undefined;
    if (vehicleData) {
      const { data: photoData } = await supabase
        .from('vehicle_photos')
        .select('photo_url')
        .eq('vehicle_id', vehicleData.id)
        .eq('photo_type', 'front')
        .single();
      
      vehiclePhotoUrl = photoData?.photo_url;
    }
    
    setProfile({
      ...profileData,
      vehicle_photo_url: vehiclePhotoUrl
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const menuItems = [
    {
      section: 'ข้อมูลส่วนตัว',
      items: [
        { icon: User, label: 'บัญชี', path: '/account' },
        { icon: Truck, label: 'ข้อมูลรถ', path: '/vehicle-info' },
      ]
    },
    {
      section: 'ทั่วไป',
      items: [
        { icon: Bell, label: 'การแจ้งเตือน', hasToggle: true },
      ]
    },
    {
      section: 'ข้อมูลเกี่ยวกับแอป',
      items: [
        { icon: Globe, label: 'ภาษา', path: '/language' },
        { icon: Info, label: 'เงื่อนไขการใช้บริการและนโยบาย', path: '/terms' },
        { icon: HelpCircle, label: 'ติดต่อศูนย์', path: '/contact' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-6 text-center">
        <h1 className="text-xl font-semibold">ตั้งค่า</h1>
      </header>

      {/* Profile Section */}
      <div className="bg-white p-4 mb-2">
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile?.vehicle_photo_url || profile?.avatar_url} alt={profile?.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile?.full_name?.charAt(0) || "👤"}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-foreground">{profile?.full_name || "โปรไฟล์"}</span>
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
                        {notificationsEnabled ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                      </span>
                      <Switch 
                        checked={notificationsEnabled}
                        onCheckedChange={setNotificationsEnabled}
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
                      <span className="text-foreground">{item.label}</span>
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
          ออกจากระบบ
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
              คุณต้องการออกจากระบบหรือไม่?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              การออกจากระบบจะทำให้คุณต้องล็อกอินเข้าสู่ระบบอีกครั้ง ในครั้งถัดไป กรุณายืนยันออกจากระบบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={handleSignOut}
              className="flex-1 m-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              ออกจากระบบ
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 m-0">ยกเลิก</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNavigation />
    </div>
  );
}
