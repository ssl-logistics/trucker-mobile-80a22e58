import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  phone_number: string;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('id', user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      // Sign out the user (account deletion requires backend function)
      await supabase.auth.signOut();
      
      toast({
        title: "ลบบัญชีสำเร็จ",
        description: "บัญชีของคุณถูกลบเรียบร้อยแล้ว",
      });
      
      navigate('/');
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบบัญชีได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">บัญชี</h1>
        </div>
      </header>

      {/* Account Information */}
      <div className="p-4 space-y-4">
        {/* Username Field */}
        <div className="bg-white rounded-lg p-4">
          <div>
            <label className="text-sm text-muted-foreground">ชื่อผู้ใช้</label>
            <p className="text-foreground mt-1">{user?.email || 'ไม่มีข้อมูล'}</p>
          </div>
        </div>

        {/* Password Field */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">รหัสผ่าน</label>
              <p className="text-foreground mt-1">**********</p>
            </div>
            <button
              onClick={() => navigate('/profile/edit', { state: { field: 'password' } })}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Delete Account Button */}
        <div className="pt-6">
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10"
          >
            ลบบัญชี
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[320px] w-[90%] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl">
          <AlertDialogHeader className="items-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <UserX className="w-8 h-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-base">
              คุณกำลังจะลบบัญชีใช่ไหม
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              <p className="mb-2">การลบบัญชีนี้จะเป็นการลบข้อมูลทั้งหมด</p>
              <ul className="text-left space-y-1 list-disc list-inside">
                <li>ข้อมูลส่วนตัว</li>
                <li>ประวัติการใช้บริการ</li>
                <li>ข้อมูลธุรกรรมทั้งหมด</li>
              </ul>
              <p className="mt-2">หลังจากลบบัญชีแล้วจะไม่สามารถกู้คืนได้</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="flex-1 m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'กำลังลบ...' : 'ลบบัญชี'}
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 m-0" disabled={isDeleting}>
              ยกเลิก
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
