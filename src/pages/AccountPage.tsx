import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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

export default function AccountPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      // Call edge function to delete account using Supabase client
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) {
        throw error;
      }

      toast({
        title: t('account.delete_success'),
        description: t('account.delete_success_desc'),
      });

      // Sign out after successful deletion
      await supabase.auth.signOut();
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({
        title: t('account.delete_error'),
        description: error.message || t('account.delete_error_desc'),
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
      <header className="bg-header text-header-foreground page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/settings')} className="absolute left-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('account.title')}</h1>
        </div>
      </header>

      {/* Account Information */}
      <div className="p-4 space-y-4">
        {/* Username Field */}
        <div className="bg-white rounded-lg p-4">
          <div>
            <label className="text-sm text-muted-foreground">{t('account.username')}</label>
            <p className="text-foreground mt-1">{user?.username || t('account.no_data')}</p>
          </div>
        </div>

        {/* Password Field */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">{t('account.password')}</label>
              <p className="text-foreground mt-1">**********</p>
            </div>
            <button
              onClick={() => navigate('/change-password')}
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
            {t('account.delete')}
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
              {t('account.delete_confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              <p className="mb-2">{t('account.delete_desc')}</p>
              <ul className="text-left space-y-1 list-disc list-inside">
                <li>{t('account.delete_personal')}</li>
                <li>{t('account.delete_history')}</li>
                <li>{t('account.delete_transactions')}</li>
              </ul>
              <p className="mt-2">{t('account.delete_warning')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="flex-1 m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('account.deleting') : t('account.delete')}
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 m-0" disabled={isDeleting}>
              {t('account.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
