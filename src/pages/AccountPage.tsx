import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AUTH_KEYS, removeAuthItem, setAuthItem, getAuthItem } from '@/utils/authStorage';
import { updateFreelanceDriver } from '@/lib/externalApi';
import { saveDriverBank } from '@/lib/driverProfileData';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { isDriverNotFoundError, isOAuthLoginType } from '@/utils/oauthDriverSync';
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
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { isFreelanceDriver, userType } = useUserRole();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bank info state (freelance only)
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);

  // Load existing bank info from auth_driver (external API data) — only once per user
  useEffect(() => {
    if (!isFreelanceDriver || !user) return;
    if (bankLoaded) return; // prevent reset after save-triggered user updates
    setBankName(user.bank_name || '');
    setBankAccountNumber(user.bank_account_number || user.account_number || '');
    setBankAccountName(user.bank_account_name || user.account_name || user.full_name || '');
    setBankLoaded(true);
  }, [isFreelanceDriver, user, bankLoaded]);

  const handleSaveBank = async () => {
    if (!user?.id || !bankName.trim() || !bankAccountNumber.trim()) return;

    setIsSavingBank(true);
    try {
      const isOAuthUser = isOAuthLoginType(user.loginType);
      const shouldSyncExternal = !isOAuthUser || user.loginType === 'line';

      // LINE still attempts external sync, but OAuth users can gracefully fallback to local-only.
      // Any TMS error (network or "driver not found") is non-fatal — we persist to our own backend below.
      if (shouldSyncExternal) {
        try {
          const driverType = getDriverTypeFromUserType(userType || 'freelance_driver');
          const { data, error } = await updateFreelanceDriver({
            driver_id: user.id,
            driver_type: driverType,
            bank_name: bankName.trim(),
            account_number: bankAccountNumber.trim(),
            account_name: bankAccountName.trim() || user.full_name || '',
          });
          if (error && !isDriverNotFoundError(error, data)) {
            console.warn('[Bank] TMS update non-fatal error:', error);
          }
        } catch (tmsErr: any) {
          console.warn('[Bank] TMS update failed (non-fatal):', tmsErr?.message);
        }
      }

      // Always persist to our own backend so data survives logout/login
      await saveDriverBank(user.id, {
        bank_name: bankName.trim(),
        account_number: bankAccountNumber.trim(),
        account_name: bankAccountName.trim() || user.full_name || '',
      });

      // Update local auth_driver with new bank info
      const storedDriver = await getAuthItem('auth_driver');
      let mergedDriver: any = null;
      if (storedDriver) {
        try {
          const driverObj = JSON.parse(storedDriver);
          driverObj.bank_name = bankName.trim();
          driverObj.bank_account_number = bankAccountNumber.trim();
          driverObj.bank_account_name = bankAccountName.trim() || user.full_name || '';
          driverObj.account_number = bankAccountNumber.trim();
          driverObj.account_name = bankAccountName.trim() || user.full_name || '';
          mergedDriver = driverObj;
          await setAuthItem('auth_driver', JSON.stringify(driverObj));
        } catch {}
      }

      // Fallback: merge onto current user if storage read failed
      if (!mergedDriver) {
        mergedDriver = {
          ...(user as any),
          bank_name: bankName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_account_name: bankAccountName.trim() || user.full_name || '',
          account_number: bankAccountNumber.trim(),
          account_name: bankAccountName.trim() || user.full_name || '',
        };
        await setAuthItem('auth_driver', JSON.stringify(mergedDriver));
      }

      // Dispatch with driver payload so AuthContext updates user state immediately
      // (do NOT call refreshUser: for LINE it re-fetches TMS which may not return bank fields
      // and would overwrite the values we just saved locally)
      window.dispatchEvent(new CustomEvent('auth_driver_updated', {
        detail: {
          driver: mergedDriver,
          userType: userType || 'freelance_driver',
        },
      }));

      toast({
        title: t('account.bank_save_success'),
      });
    } catch (error: any) {
      console.error('Save bank error:', error);
      toast({
        title: t('account.bank_save_error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      const userEmail = user?.email;
      const driverCode = user?.driver_code;
      
      if (!userEmail) {
        throw new Error('ไม่พบอีเมลผู้ใช้');
      }

      const { data, error } = await supabase.functions.invoke('delete-driver', {
        body: { 
          email: userEmail,
          driverCode: driverCode 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t('account.delete_success'),
        description: t('account.delete_success_desc'),
      });

      await Promise.all(AUTH_KEYS.map(key => removeAuthItem(key)));
      window.location.replace('/');
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

        {/* Bank Info - Freelance only */}
        {isFreelanceDriver && bankLoaded && (
          <div className="bg-white rounded-lg p-4 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">{t('account.bank_name')}</label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue placeholder={t('account.bank_name')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ธนาคารกรุงเทพ">ธนาคารกรุงเทพ (BBL)</SelectItem>
                  <SelectItem value="ธนาคารกสิกรไทย">ธนาคารกสิกรไทย (KBANK)</SelectItem>
                  <SelectItem value="ธนาคารกรุงไทย">ธนาคารกรุงไทย (KTB)</SelectItem>
                  <SelectItem value="ธนาคารไทยพาณิชย์">ธนาคารไทยพาณิชย์ (SCB)</SelectItem>
                  <SelectItem value="ธนาคารกรุงศรีอยุธยา">ธนาคารกรุงศรีอยุธยา (BAY)</SelectItem>
                  <SelectItem value="ธนาคารทหารไทยธนชาต">ธนาคารทหารไทยธนชาต (TTB)</SelectItem>
                  <SelectItem value="ธนาคารออมสิน">ธนาคารออมสิน (GSB)</SelectItem>
                  <SelectItem value="ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร">ธ.ก.ส. (BAAC)</SelectItem>
                  <SelectItem value="ธนาคารอาคารสงเคราะห์">ธนาคารอาคารสงเคราะห์ (GHB)</SelectItem>
                  <SelectItem value="ธนาคารซีไอเอ็มบีไทย">ธนาคารซีไอเอ็มบีไทย (CIMBT)</SelectItem>
                  <SelectItem value="ธนาคารยูโอบี">ธนาคารยูโอบี (UOB)</SelectItem>
                  <SelectItem value="ธนาคารแลนด์แอนด์เฮ้าส์">ธนาคารแลนด์แอนด์เฮ้าส์ (LHBANK)</SelectItem>
                  <SelectItem value="ธนาคารเกียรตินาคินภัทร">ธนาคารเกียรตินาคินภัทร (KKP)</SelectItem>
                  <SelectItem value="ธนาคารอิสลามแห่งประเทศไทย">ธนาคารอิสลามแห่งประเทศไทย (IBANK)</SelectItem>
                  <SelectItem value="ธนาคารทิสโก้">ธนาคารทิสโก้ (TISCO)</SelectItem>
                  <SelectItem value="ธนาคารไอซีบีซี">ธนาคารไอซีบีซี (ICBC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t('account.bank_account_name')}</label>
              <Input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder={t('account.bank_account_name')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t('account.bank_account_number')}</label>
              <Input
                value={bankAccountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setBankAccountNumber(val);
                }}
                inputMode="numeric"
                maxLength={15}
                placeholder={t('account.bank_account_number')}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSaveBank}
              disabled={isSavingBank || !bankName.trim() || !bankAccountNumber.trim()}
              className="w-full"
            >
              {isSavingBank ? t('account.bank_saving') : t('account.bank_save')}
            </Button>
          </div>
        )}

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
