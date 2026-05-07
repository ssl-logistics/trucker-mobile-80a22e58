import { OnboardingTour, TourStep } from "./OnboardingTour";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";

export const HomeTour = () => {
  const { isFreelance, isInternalDriver, isExternalDriver } = useUserRole();
  const { t } = useLanguage();

  // Define steps for Freelance drivers
  const getFreelanceSteps = (): TourStep[] => [
    {
      target: '[data-tour="header"]',
      title: "ยินดีต้อนรับ! 👋",
      description: "นี่คือแถบด้านบนที่แสดงข้อมูลโปรไฟล์และสถานะของคุณ",
      position: "bottom" as const,
    },
    {
      target: '[data-tour="available-jobs"]',
      title: "งานที่พร้อมรับ 📦",
      description: "ดูรายการงานทั้งหมดที่คุณสามารถรับได้ กดที่การ์ดเพื่อดูรายละเอียดและกดรับงาน",
      position: "top" as const,
    },
    {
     target: '[data-tour="current-jobs-menu"]',
     title: "งานปัจจุบัน 🚛",
     description: "ติดตามงานที่กำลังดำเนินการ อัปเดตสถานะ และเช็คอินได้ที่นี่",
     position: "bottom" as const,
   },
   {
      target: '[data-tour="bidding-menu"]',
      title: "ประมูลงาน 🎯",
      description: "เสนอราคาเพื่อประมูลงานที่ต้องการ คุณสามารถตั้งราคาเองได้",
     position: "top" as const,
    },
    {
      target: '[data-tour="dashboard-nav"]',
      title: "แผงควบคุม 📊",
      description: "ดูข้อมูล 4 หมวด: การเงิน การจัดส่ง ลูกค้า และสินค้า",
      position: "top" as const,
    },
    {
      target: '[data-tour="chat-nav"]',
      title: "โทร 📞",
      description: "รอรับสายจากบริษัทหรือโรงงานที่โทรเข้ามาหาคุณ",
      position: "top" as const,
    },
    {
      target: '[data-tour="settings-nav"]',
      title: "ตั้งค่า ⚙️",
      description: "จัดการโปรไฟล์ ข้อมูลรถ และการแจ้งเตือน",
      position: "top" as const,
    },
  ];

  // Define steps for Internal/External drivers (Staff)
  const getStaffSteps = (): TourStep[] => [
    {
      target: '[data-tour="header"]',
      title: "ยินดีต้อนรับ! 👋",
      description: "แถบด้านบนแสดงข้อมูลโปรไฟล์และสังกัดของคุณ",
      position: "bottom" as const,
    },
    {
      target: '[data-tour="available-jobs"]',
      title: "งานที่ได้รับมอบหมาย 📦",
      description: "ดูรายการงานที่บริษัท/โรงงานมอบหมายให้คุณ กดเพื่อดูรายละเอียดและเริ่มงาน",
      position: "top" as const,
    },
    {
      target: '[data-tour="current-jobs-menu"]',
      title: "งานปัจจุบัน 🚛",
      description: "ติดตามงานที่กำลังวิ่ง เช็คอิน ถ่ายรูป SOP และอัปเดตสถานะได้ที่นี่",
      position: "bottom" as const,
    },
    {
      target: '[data-tour="chat-nav"]',
      title: "โทร 📞",
      description: "รอรับสายจากบริษัทหรือโรงงานที่โทรเข้ามาหาคุณ",
      position: "top" as const,
    },
    {
      target: '[data-tour="settings-nav"]',
      title: "ตั้งค่า ⚙️",
      description: "จัดการข้อมูลส่วนตัว ข้อมูลรถ และการแจ้งเตือน",
      position: "top" as const,
    },
  ];

  const getSteps = (): TourStep[] => {
    // Internal/External drivers get staff-specific tour
    if (isInternalDriver || isExternalDriver) {
      return getStaffSteps();
    }
    
    // Freelance drivers get full feature tour
    if (isFreelance) {
      return getFreelanceSteps();
    }

    // Default fallback (basic tour)
    return [
      {
        target: '[data-tour="header"]',
        title: "ยินดีต้อนรับ! 👋",
        description: "นี่คือแถบด้านบนที่แสดงข้อมูลโปรไฟล์ของคุณ",
        position: "bottom" as const,
      },
      {
        target: '[data-tour="available-jobs"]',
        title: "งานที่พร้อมรับ 📦",
        description: "ดูรายการงานทั้งหมดที่คุณสามารถรับได้ที่นี่",
        position: "top" as const,
      },
      {
        target: '[data-tour="bottom-nav"]',
        title: "เมนูด้านล่าง 🧭",
        description: "ใช้เมนูนี้เพื่อไปยังหน้าต่างๆ ของแอป",
        position: "top" as const,
      },
    ];
  };

  return (
    <OnboardingTour
      steps={getSteps()}
      storageKey="home-tour-completed"
      onComplete={() => console.log("Home tour completed!")}
    />
  );
};
