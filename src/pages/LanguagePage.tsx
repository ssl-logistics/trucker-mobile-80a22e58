import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import flagTh from '@/assets/flag-th.png';
import flagEn from '@/assets/flag-en.png';
import flagKo from '@/assets/flag-ko.png';
import flagCn from '@/assets/flag-cn.png';

export default function LanguagePage() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'th' | 'en' | 'ko' | 'zh');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/settings')} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('language.title')}</h1>
        </div>
      </header>

      {/* Language Options */}
      <div className="bg-white mt-2">
        <RadioGroup value={language} onValueChange={handleLanguageChange}>
          <div className="divide-y">
            {/* Thai */}
            <div 
              className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              onClick={() => handleLanguageChange('th')}
            >
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
            <div 
              className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              onClick={() => handleLanguageChange('en')}
            >
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

            {/* Korean */}
            <div 
              className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              onClick={() => handleLanguageChange('ko')}
            >
              <div className="flex items-center gap-3">
                <img 
                  src={flagKo} 
                  alt="Korean flag" 
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <Label htmlFor="korean" className="text-base font-normal cursor-pointer">
                  {t('language.korean')}
                </Label>
              </div>
              <RadioGroupItem value="ko" id="korean" className="border-2" />
            </div>

            {/* Chinese */}
            <div 
              className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
              onClick={() => handleLanguageChange('zh')}
            >
              <div className="flex items-center gap-3">
                <img 
                  src={flagCn} 
                  alt="Chinese flag" 
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <Label htmlFor="chinese" className="text-base font-normal cursor-pointer">
                  {t('language.chinese')}
                </Label>
              </div>
              <RadioGroupItem value="zh" id="chinese" className="border-2" />
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
