import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff, X } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, userType, logout } = useAuth();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsDontMatch = confirmPassword && newPassword !== confirmPassword;
  const isValid = newPassword.length >= 6 && passwordsMatch;

  const handleSubmit = async () => {
    if (!isValid) return;

    const driverId = user?.id;

    if (!driverId) {
      toast({
        title: t('changePassword.error'),
        description: t('changePassword.errorDesc'),
        variant: "destructive",
      });
      return;
    }

    const passwordSchema = z
      .object({
        newPassword: z.string().min(6, t('changePassword.minLength')),
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: t('changePassword.passwordMismatch'),
        path: ['confirmPassword'],
      });

    try {
      passwordSchema.parse({ newPassword, confirmPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('changePassword.invalidData'),
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Password is stored on external freelance_drivers, update via backend proxy
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-freelance-driver`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            driver_id: driverId,
            driver_type: getDriverTypeFromUserType(userType),
            password: newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || data?.error || t('changePassword.errorDesc'));
      }

      toast({
        title: t('changePassword.success'),
        description: t('changePassword.successDesc'),
      });

      // Log out and redirect to login
      logout();
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Change password error:', error);
      toast({
        title: t('changePassword.error'),
        description: error?.message || t('changePassword.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/account')} className="absolute left-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('changePassword.title')}</h1>
        </div>
      </header>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* New Password Field */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">{t('changePassword.newPassword')}</label>
          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="**********"
              className="pr-20 border-0 border-b border-muted focus:border-primary rounded-none px-0 shadow-none focus-visible:ring-0"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {newPassword && (
                <button
                  onClick={() => setNewPassword('')}
                  className="p-1 hover:bg-muted rounded-full"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="p-1 hover:bg-muted rounded-full"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Eye className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">{t('changePassword.confirmPassword')}</label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="**********"
              className="pr-20 border-0 border-b border-muted focus:border-primary rounded-none px-0 shadow-none focus-visible:ring-0"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {confirmPassword && (
                <button
                  onClick={() => setConfirmPassword('')}
                  className="p-1 hover:bg-muted rounded-full"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="p-1 hover:bg-muted rounded-full"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Eye className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Password Match Status */}
        {confirmPassword && (
          <p className={`text-sm ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}>
            {passwordsMatch ? t('changePassword.passwordMatch') : t('changePassword.passwordMismatch')}
          </p>
        )}

        {/* Submit Button */}
        <div className="pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSubmitting ? t('changePassword.changing') : t('changePassword.usePassword')}
          </Button>
        </div>
      </div>
    </div>
  );
}
