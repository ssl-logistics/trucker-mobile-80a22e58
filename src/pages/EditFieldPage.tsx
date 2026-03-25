import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { isDriverNotFoundError } from '@/utils/oauthDriverSync';
import { updateFreelanceDriver } from '@/lib/externalApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function EditFieldPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userType } = useAuth();
  const { t } = useLanguage();
  const { field, value: initialValue, fullName } = location.state || {};
  
  const [value, setValue] = useState(initialValue || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Build update payload for external API
      const updatePayload: {
        driver_id: string;
        driver_type: 'internal' | 'external' | 'freelance';
        first_name?: string;
        last_name?: string;
        phone?: string;
      } = {
        driver_id: user.id,
        driver_type: getDriverTypeFromUserType(userType),
      };

      if (field === 'firstName') {
        updatePayload.first_name = value;
      } else if (field === 'lastName') {
        updatePayload.last_name = value;
      } else if (field === 'phone') {
        updatePayload.phone = value;
      }

      console.log('Sending update payload:', updatePayload);

      // Call the external API directly (single request)
      const { data, error } = await updateFreelanceDriver(updatePayload);
      const shouldFallbackToLocal = isDriverNotFoundError(error, data);

      if (error && !shouldFallbackToLocal) {
        console.error('Update error:', error);
        toast({ 
          title: t('editField.error'), 
          description: error || t('editField.updateError'), 
          variant: 'destructive' 
        });
      } else if (data?.success || shouldFallbackToLocal) {
        if (shouldFallbackToLocal) {
          console.warn('Driver not found in external system, saving via edge function instead:', user.id);
        }

        toast({ title: t('editField.success'), description: t('editField.updated') });

        // Persist into profiles table via edge function (bypasses RLS for OAuth users)
        const existingFullName = fullName || user.full_name || '';
        const [existingFirstName, ...remainingNameParts] = existingFullName.trim().split(' ');
        const existingLastName = remainingNameParts.join(' ');
        const nextFirstName = field === 'firstName' ? value : existingFirstName;
        const nextLastName = field === 'lastName' ? value : existingLastName;

        const profilePayload: Record<string, string> = { user_id: user.id };

        if (field === 'phone') {
          profilePayload.phone_number = value;
        }

        if (field === 'firstName' || field === 'lastName') {
          profilePayload.full_name = `${nextFirstName || ''} ${nextLastName || ''}`.trim();
        }

        // Call edge function with service role to update profiles
        const profileResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-profile`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify(profilePayload),
          }
        );
        const profileResult = await profileResp.json();
        console.log('Profile update result:', profileResult);
        
        
        
        navigate('/profile');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({ 
        title: t('editField.error'), 
        description: t('editField.updateError'), 
        variant: 'destructive' 
      });
    }

    setLoading(false);
  };
  
  // Get display label for field
  const getFieldLabel = () => {
    switch (field) {
      case 'firstName': return t('profile.first_name');
      case 'lastName': return t('profile.last_name');
      case 'phone': return t('profile.phone');
      default: return field;
    }
  };

  const handleClear = () => {
    setValue('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center justify-center relative">
          <button 
            onClick={() => navigate('/profile')} 
            className="absolute left-0 p-2 -m-2 hover:opacity-70 active:opacity-50 transition-opacity"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('editField.profile')}</h1>
        </div>
      </header>

      {/* Edit Form */}
      <div className="p-4">
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">{getFieldLabel()}</div>
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => {
                if (field === 'phone') {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setValue(val);
                } else {
                  setValue(e.target.value);
                }
              }}
              inputMode={field === 'phone' ? 'numeric' : 'text'}
              className="border-0 border-b border-gray-300 rounded-none px-0 pb-2 focus-visible:ring-0 focus-visible:border-blue-600 text-lg shadow-none"
              placeholder={getFieldLabel()}
              autoFocus
            />
            {value && (
              <button
                onClick={handleClear}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        {field === 'phone' && value.trim().length > 0 && value.trim().length < 10 && (
          <p className="text-sm text-destructive mt-1">{t('editField.phone_min_length')}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={loading || !value.trim() || (field === 'phone' && value.trim().length < 10)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base"
        >
          {t('editField.save')}
        </Button>
      </div>
    </div>
  );
}
