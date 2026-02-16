import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook that checks if a freelance driver has bank account info.
 * If not, redirects to Account page before allowing job actions.
 */
export const useBankCheck = () => {
  const { user } = useAuth();
  const { isFreelanceDriver } = useUserRole();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [hasBankInfo, setHasBankInfo] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isFreelanceDriver || !user?.id) {
      setHasBankInfo(true); // non-freelance users skip this check
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setHasBankInfo(!!data);
    };

    check();
  }, [isFreelanceDriver, user?.id]);

  /**
   * Returns true if bank info exists (or not freelance).
   * If missing, shows toast and navigates to /account, returns false.
   */
  const requireBankInfo = useCallback((): boolean => {
    if (!isFreelanceDriver) return true;
    if (hasBankInfo) return true;

    toast({
      title: t('account.bank_required'),
      description: t('account.bank_required_desc'),
      variant: 'destructive',
    });
    navigate('/account');
    return false;
  }, [isFreelanceDriver, hasBankInfo, navigate, t]);

  return { hasBankInfo, requireBankInfo };
};
