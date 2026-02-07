import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { setAuthItem, getAuthItem } from '@/utils/authStorage';
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
      const updatePayload: Record<string, string> = {
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

      // Call the external API via edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-freelance-driver`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(updatePayload),
        }
      );

      const data = await response.json();
      const error = !response.ok ? data : null;

      if (error) {
        console.error('Update error:', error);
        toast({ 
          title: t('editField.error'), 
          description: error.message || t('editField.updateError'), 
          variant: 'destructive' 
        });
      } else {
        toast({ title: t('editField.success'), description: t('editField.updated') });
        
        // Update local storage immediately with new data
        const storedDriver = await getAuthItem('auth_driver');
        if (storedDriver) {
          try {
            const driverData = JSON.parse(storedDriver);
            if (field === 'firstName') {
              driverData.first_name = value;
            } else if (field === 'lastName') {
              driverData.last_name = value;
            } else if (field === 'phone') {
              driverData.phone = value;
              driverData.phone_number = value;
            }
            await setAuthItem('auth_driver', JSON.stringify(driverData));
            // Dispatch event to notify AuthContext to reload
            window.dispatchEvent(new Event('auth_driver_updated'));
          } catch (e) {
            console.error('Error updating local storage:', e);
          }
        }
        
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
              onChange={(e) => setValue(e.target.value)}
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

        <Button
          onClick={handleSave}
          disabled={loading || !value.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base"
        >
          {t('editField.save')}
        </Button>
      </div>
    </div>
  );
}
