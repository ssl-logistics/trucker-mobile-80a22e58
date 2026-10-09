# แก้หน้าโหลดเต็มจอตอนกดเมนู งานปัจจุบัน / ประวัติงาน ครั้งแรก

## สาเหตุ (ยืนยันจากโค้ดแล้ว)
- `/current-jobs` และ `/job-history` เป็น lazy chunk (โหลดแยกตอนเข้าครั้งแรก)
- อยู่นอก TabLayout (เชลล์ของแท็บล่าง) จึง fallback เป็น `PageLoader` — ตัวหมุนเต็มจอ (`min-h-screen`) ใน `src/App.tsx`
- ตัวหน้าเอง (CurrentJobsPage / JobHistoryPage) มี skeleton เฉพาะจุดอยู่แล้ว แต่ถูกบังด้วย PageLoader ตอน chunk กำลังโหลด จึงดูเหมือน reload ทั้งหน้า

## ทำอะไร
- เพิ่มการ preload chunk ของ `/current-jobs` และ `/job-history` เข้าระบบ warm-up เดิม (เรียกตอนแอป idle หลังเปิดหน้าหลัก ~1.5 วินาที) โดยเพิ่ม 2 บรรทัดใน `TabLayout` (`src/App.tsx`):
  - `registerTabPreload("/current-jobs", CurrentJobsPage.preload);`
  - `registerTabPreload("/job-history", JobHistoryPage.preload);`
- ผลคือ: กดเมนู งานปัจจุบัน / ประวัติงาน ครั้งแรกจะไม่เจอหน้าโหลดเต็มจออีก — หน้าขึ้นทันทีพร้อม skeleton เฉพาะจุดตามที่มีอยู่
- ไม่แก้ flow/ข้อมูล/หน้าอื่น

## หมายเหตุ
- เข้าตรงลิงก์ลึกมาที่หน้านี้ครั้งแรก (นอกแท็บหลัก) อาจยังเห็น PageLoader ได้ แต่กรณีใช้งานปกติจากหน้าแรกจะไม่เจอแล้ว
- ตรวจ `npx tsgo --noEmit -p tsconfig.app.json` + build ต้องผ่าน
