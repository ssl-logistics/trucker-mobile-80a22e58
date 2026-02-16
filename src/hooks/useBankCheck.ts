import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook that checks if a freelance driver has bank account info.
 * Reads from the auth_driver data (external API source).
 * If not, redirects to Account page before allowing job actions.
 */
export const useBankCheck = () => {
  const { user } = useAuth();
  const { isFreelanceDriver } = useUserRole();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Check bank info directly from the user object (loaded from external API)
  const hasBankInfo = !isFreelanceDriver || (!!user?.bank_name && !!(user?.bank_account_number || user?.account_number));

  /**
   * Returns true if bank info exists (or not freelance).
   * If missing, shows toast and navigates to /account, returns false.
   */
  const requireBankInfo = useCallback((): boolean => {
    if (!isFreelanceDriver) return true;
    if (user?.bank_name && (user?.bank_account_number || user?.account_number)) return true;

    toast({
      title: t('account.bank_required'),
      description: t('account.bank_required_desc'),
      variant: 'destructive',
    });
    navigate('/account');
    return false;
  }, [isFreelanceDriver, user?.bank_name, user?.account_number, navigate, t]);

  return { hasBankInfo, requireBankInfo };
};
