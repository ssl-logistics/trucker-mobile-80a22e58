import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'th' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'th';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string): string => {
    const translations = language === 'th' ? thTranslations : enTranslations;
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// Thai translations
const thTranslations: Record<string, string> = {
  // Settings Page
  'settings.title': 'ตั้งค่า',
  'settings.profile': 'โปรไฟล์',
  'settings.personal_info': 'ข้อมูลส่วนตัว',
  'settings.account': 'บัญชี',
  'settings.vehicle_info': 'ข้อมูลรถ',
  'settings.general': 'ทั่วไป',
  'settings.notifications': 'การแจ้งเตือน',
  'settings.notifications_enabled': 'เปิดแจ้งเตือน',
  'settings.notifications_disabled': 'ปิดแจ้งเตือน',
  'settings.about': 'ข้อมูลเกี่ยวกับแอป',
  'settings.language': 'ภาษา',
  'settings.terms': 'เงื่อนไขการใช้บริการและนโยบาย',
  'settings.contact': 'ติดต่อศูนย์',
  'settings.sign_out': 'ออกจากระบบ',
  'settings.sign_out_confirm': 'คุณต้องการออกจากระบบหรือไม่?',
  'settings.sign_out_description': 'การออกจากระบบจะทำให้คุณต้องล็อกอินเข้าสู่ระบบอีกครั้ง ในครั้งถัดไป กรุณายืนยันออกจากระบบ',
  'settings.cancel': 'ยกเลิก',
  
  // Language Page
  'language.title': 'ภาษา',
  'language.thai': 'ภาษาไทย',
  'language.english': 'English',
  
  // Bottom Navigation
  'nav.home': 'หน้าแรก',
  'nav.dashboard': 'แผงควบคุม',
  'nav.chat': 'แชท',
  'nav.settings': 'ตั้งค่า',
};

// English translations
const enTranslations: Record<string, string> = {
  // Settings Page
  'settings.title': 'Settings',
  'settings.profile': 'Profile',
  'settings.personal_info': 'Personal Information',
  'settings.account': 'Account',
  'settings.vehicle_info': 'Vehicle Information',
  'settings.general': 'General',
  'settings.notifications': 'Notifications',
  'settings.notifications_enabled': 'Notifications On',
  'settings.notifications_disabled': 'Notifications Off',
  'settings.about': 'About App',
  'settings.language': 'Language',
  'settings.terms': 'Terms of Service and Policy',
  'settings.contact': 'Contact Center',
  'settings.sign_out': 'Sign Out',
  'settings.sign_out_confirm': 'Do you want to sign out?',
  'settings.sign_out_description': 'Signing out will require you to log in again next time. Please confirm sign out.',
  'settings.cancel': 'Cancel',
  
  // Language Page
  'language.title': 'Language',
  'language.thai': 'ภาษาไทย',
  'language.english': 'English',
  
  // Bottom Navigation
  'nav.home': 'Home',
  'nav.dashboard': 'Dashboard',
  'nav.chat': 'Chat',
  'nav.settings': 'Settings',
};
