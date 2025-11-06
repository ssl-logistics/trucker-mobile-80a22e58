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
  
  // Home Page
  'home.search': 'ค้นหา',
  'home.recommended': 'งานแนะนำสำหรับคุณ',
  'home.items': 'รายการ',
  'home.error_load': 'เกิดข้อผิดพลาด',
  'home.error_load_desc': 'ไม่สามารถโหลดข้อมูลงานได้',
  'home.error_accept': 'ไม่สามารถรับงานได้',
  'home.accept_success': 'รับงานสำเร็จ',
  'home.accept_success_desc': 'คุณได้รับงาน',
  
  // Dashboard Page
  'dashboard.finance': 'การเงิน (ค่าใช้จ่าย)',
  'dashboard.finance_desc': 'ติดตามรายรับ, รายจ่าย ได้ง่าย',
  'dashboard.shipping': 'การจัดส่ง',
  'dashboard.shipping_desc': 'ตรวจสอบการจัดส่งของคุณ',
  'dashboard.customer': 'ลูกค้า',
  'dashboard.customer_desc': 'ดูข้อมูลลูกค้าของคุณ',
  'dashboard.product': 'สินค้า',
  'dashboard.product_desc': 'ดูข้อมูลประเภทสินค้า',
  'dashboard.view': 'ดู',
  
  // Search Page
  'search.title': 'ค้นหา',
  'search.search': 'ค้นหา',
  'search.results': 'ผลการค้นหา',
  'search.no_results': 'ไม่พบผลการค้นหา',
  'search.recent': 'คำค้นหาล่าสุด',
  'search.popular': 'คำค้นหายอดนิยม',
  'search.filter': 'ตัวกรอง',
  'search.filter_desc': 'กรองผลการค้นหา',
  'search.domestic': 'ขนส่งภายในประเทศ',
  'search.international': 'ขนส่งภายนอกประเทศ',
  'search.province': 'จังหวัด',
  'search.district': 'อำเภอ',
  'search.select_province': 'เลือกจังหวัด',
  'search.select_district': 'เลือกอำเภอ',
  'search.select_district_first': 'กรุณาเลือกจังหวัดก่อน',
  'search.price_range': 'ช่วงราคา (฿)',
  'search.min_price': 'ใส่ราคาต่ำสุด',
  'search.max_price': 'ใส่ราคาสูงสุด',
  'search.clear': 'ล้างค่า',
  'search.apply': 'ค้นหา',
  
  // Profile Page
  'profile.title': 'โปรไฟล์',
  'profile.first_name': 'ชื่อ',
  'profile.last_name': 'นามสกุล',
  'profile.phone': 'เบอร์โทรศัพท์',
  'profile.email': 'อีเมล',
  'profile.work_areas': 'อำเภอ หรือ จังหวัด ที่ถนัดหรือจังหวัดทั่วเป็นประจำ',
  'profile.price_range': 'เรทราคาวังงาน (฿)',
  'profile.change_avatar': 'ยืนยันการเปลี่ยนรูปโปรไฟล์',
  'profile.change_avatar_desc': 'คุณต้องการเปลี่ยนรูปโปรไฟล์เป็นรูปนี้หรือไม่?',
  'profile.confirm': 'ยืนยัน',
  'profile.cancel': 'ยกเลิก',
  'profile.uploading': 'กำลังอัพโหลด...',
  'profile.error_upload': 'ไม่สามารถอัพโหลดรูปภาพได้',
  'profile.error_update': 'ไม่สามารถอัพเดทโปรไฟล์ได้',
  'profile.success': 'สำเร็จ',
  'profile.success_desc': 'อัพเดทรูปโปรไฟล์แล้ว',
  
  // Account Page
  'account.title': 'บัญชี',
  'account.username': 'ชื่อผู้ใช้',
  'account.no_data': 'ไม่มีข้อมูล',
  'account.password': 'รหัสผ่าน',
  'account.delete': 'ลบบัญชี',
  'account.delete_confirm': 'คุณกำลังจะลบบัญชีใช่ไหม',
  'account.delete_desc': 'การลบบัญชีนี้จะเป็นการลบข้อมูลทั้งหมด',
  'account.delete_personal': 'ข้อมูลส่วนตัว',
  'account.delete_history': 'ประวัติการใช้บริการ',
  'account.delete_transactions': 'ข้อมูลธุรกรรมทั้งหมด',
  'account.delete_warning': 'หลังจากลบบัญชีแล้วจะไม่สามารถกู้คืนได้',
  'account.deleting': 'กำลังลบ...',
  'account.cancel': 'ยกเลิก',
  'account.delete_success': 'ลบบัญชีสำเร็จ',
  'account.delete_success_desc': 'บัญชีของคุณถูกลบเรียบร้อยแล้ว',
  'account.delete_error': 'เกิดข้อผิดพลาด',
  'account.delete_error_desc': 'ไม่สามารถลบบัญชีได้ กรุณาลองใหม่อีกครั้ง',
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
  
  // Home Page
  'home.search': 'Search',
  'home.recommended': 'Recommended Jobs for You',
  'home.items': 'items',
  'home.error_load': 'Error',
  'home.error_load_desc': 'Unable to load jobs',
  'home.error_accept': 'Unable to accept job',
  'home.accept_success': 'Job Accepted',
  'home.accept_success_desc': 'You have accepted job',
  
  // Dashboard Page
  'dashboard.finance': 'Finance (Expenses)',
  'dashboard.finance_desc': 'Track income and expenses easily',
  'dashboard.shipping': 'Shipping',
  'dashboard.shipping_desc': 'Check your shipments',
  'dashboard.customer': 'Customer',
  'dashboard.customer_desc': 'View your customer information',
  'dashboard.product': 'Product',
  'dashboard.product_desc': 'View product type information',
  'dashboard.view': 'View',
  
  // Search Page
  'search.title': 'Search',
  'search.search': 'Search',
  'search.results': 'Search Results',
  'search.no_results': 'No results found',
  'search.recent': 'Recent Searches',
  'search.popular': 'Popular Searches',
  'search.filter': 'Filter',
  'search.filter_desc': 'Filter search results',
  'search.domestic': 'Domestic Transport',
  'search.international': 'International Transport',
  'search.province': 'Province',
  'search.district': 'District',
  'search.select_province': 'Select Province',
  'search.select_district': 'Select District',
  'search.select_district_first': 'Please select province first',
  'search.price_range': 'Price Range (฿)',
  'search.min_price': 'Enter minimum price',
  'search.max_price': 'Enter maximum price',
  'search.clear': 'Clear',
  'search.apply': 'Search',
  
  // Profile Page
  'profile.title': 'Profile',
  'profile.first_name': 'First Name',
  'profile.last_name': 'Last Name',
  'profile.phone': 'Phone Number',
  'profile.email': 'Email',
  'profile.work_areas': 'Districts or provinces you work regularly',
  'profile.price_range': 'Job Price Range (฿)',
  'profile.change_avatar': 'Confirm Profile Picture Change',
  'profile.change_avatar_desc': 'Do you want to change your profile picture to this one?',
  'profile.confirm': 'Confirm',
  'profile.cancel': 'Cancel',
  'profile.uploading': 'Uploading...',
  'profile.error_upload': 'Unable to upload image',
  'profile.error_update': 'Unable to update profile',
  'profile.success': 'Success',
  'profile.success_desc': 'Profile picture updated',
  
  // Account Page
  'account.title': 'Account',
  'account.username': 'Username',
  'account.no_data': 'No data',
  'account.password': 'Password',
  'account.delete': 'Delete Account',
  'account.delete_confirm': 'Are you sure you want to delete your account?',
  'account.delete_desc': 'Deleting this account will remove all data',
  'account.delete_personal': 'Personal information',
  'account.delete_history': 'Service history',
  'account.delete_transactions': 'All transaction data',
  'account.delete_warning': 'Account deletion cannot be undone',
  'account.deleting': 'Deleting...',
  'account.cancel': 'Cancel',
  'account.delete_success': 'Account Deleted Successfully',
  'account.delete_success_desc': 'Your account has been deleted',
  'account.delete_error': 'Error',
  'account.delete_error_desc': 'Unable to delete account. Please try again.',
};
