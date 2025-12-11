import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function EditFieldPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { field, value: initialValue, fullName } = location.state || {};
  
  const [value, setValue] = useState(initialValue || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);

    if (field === 'firstName') {
      const nameParts = fullName?.split(' ') || [];
      const newFullName = `${value} ${nameParts.slice(1).join(' ')}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newFullName })
        .eq('id', user.id);

      if (!error) {
        toast({ title: t('editField.success'), description: t('editField.updated') });
        navigate('/profile');
      } else {
        toast({ title: t('editField.error'), description: t('editField.updateError'), variant: 'destructive' });
      }
    } else if (field === 'lastName') {
      const nameParts = fullName?.split(' ') || [];
      const newFullName = `${nameParts[0]} ${value}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newFullName })
        .eq('id', user.id);

      if (!error) {
        toast({ title: t('editField.success'), description: t('editField.updated') });
        navigate('/profile');
      } else {
        toast({ title: t('editField.error'), description: t('editField.updateError'), variant: 'destructive' });
      }
    } else if (field === 'phone') {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: value })
        .eq('id', user.id);

      if (!error) {
        toast({ title: t('editField.success'), description: t('editField.updated') });
        navigate('/profile');
      } else {
        toast({ title: t('editField.error'), description: t('editField.updateError'), variant: 'destructive' });
      }
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
              className="border-b border-gray-300 rounded-none px-0 pb-2 focus-visible:ring-0 focus-visible:border-blue-600 text-lg"
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
