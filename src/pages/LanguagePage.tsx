import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import flagTh from '@/assets/flag-th.png';
import flagEn from '@/assets/flag-en.png';

export default function LanguagePage() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'th' | 'en');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/settings')} className="p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold">{t('language.title')}</h1>
      </header>

      {/* Language Options */}
      <div className="bg-white mt-2">
        <RadioGroup value={language} onValueChange={handleLanguageChange}>
          <div className="divide-y">
            {/* Thai */}
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <img 
                  src={flagTh} 
                  alt="Thai flag" 
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <Label htmlFor="thai" className="text-base font-normal cursor-pointer">
                  {t('language.thai')}
                </Label>
              </div>
              <RadioGroupItem value="th" id="thai" className="border-2" />
            </div>

            {/* English */}
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <img 
                  src={flagEn} 
                  alt="UK flag" 
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <Label htmlFor="english" className="text-base font-normal cursor-pointer">
                  {t('language.english')}
                </Label>
              </div>
              <RadioGroupItem value="en" id="english" className="border-2" />
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
