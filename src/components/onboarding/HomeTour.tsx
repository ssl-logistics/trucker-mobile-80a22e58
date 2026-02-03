import { OnboardingTour } from "./OnboardingTour";
import { useUserRole } from "@/hooks/useUserRole";

export const HomeTour = () => {
  const { isFreelance, isInternalDriver, isExternalDriver } = useUserRole();

  // Define steps based on user role
  const getSteps = () => {
    const baseSteps = [
      {
        target: '[data-tour="header"]',
        title: "ยินดีต้อนรับ! 👋",
        description: "นี่คือแถบด้านบนที่แสดงข้อมูลโปรไฟล์ของคุณ คุณสามารถกดเพื่อออกจากระบบได้",
        position: "bottom" as const,
      },
      {
        target: '[data-tour="available-jobs"]',
        title: "งานที่พร้อมรับ 📦",
        description: "ดูรายการงานทั้งหมดที่คุณสามารถรับได้ที่นี่ กดที่การ์ดเพื่อดูรายละเอียดงาน",
        position: "top" as const,
      },
      {
        target: '[data-tour="bottom-nav"]',
        title: "เมนูด้านล่าง 🧭",
        description: "ใช้เมนูนี้เพื่อไปยังหน้าต่างๆ: หน้าหลัก, งานปัจจุบัน, แชท และตั้งค่า",
        position: "top" as const,
      },
    ];

    // Add freelance-specific steps
    if (isFreelance) {
      return [
        ...baseSteps.slice(0, 2),
        {
          target: '[data-tour="bidding-menu"]',
          title: "ประมูลงาน 🎯",
          description: "คุณสามารถประมูลงานเพื่อเสนอราคาที่ต้องการได้ กดที่นี่เพื่อดูงานประมูล",
          position: "bottom" as const,
        },
        {
          target: '[data-tour="dashboard-menu"]',
          title: "แดชบอร์ด 📊",
          description: "ดูสถิติและข้อมูลสรุปการทำงานของคุณได้ที่นี่",
          position: "bottom" as const,
        },
        ...baseSteps.slice(2),
      ];
    }

    return baseSteps;
  };

  return (
    <OnboardingTour
      steps={getSteps()}
      storageKey="home-tour-completed"
      onComplete={() => console.log("Home tour completed!")}
    />
  );
};
