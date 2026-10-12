# แก้การ์ดแนะนำเมนูไม่หายในแอปที่ติดตั้ง

## สาเหตุ
แอปที่ติดตั้งลงเครื่องเปิดผ่านที่อยู่ภายในชื่อ "localhost" ซึ่งระบบนับเป็น "ลิงก์ทดสอบ" ที่ตั้งใจให้การ์ดแนะนำ (แนบเอกสาร, แจ้งซ่อม, เพิ่มค่าใช้จ่าย, ลายเซ็น ฯลฯ) แสดงทุกครั้ง จึงไม่หายแม้กดรับทราบแล้ว

## แก้ไข
- ในแอปที่ติดตั้ง ให้การ์ดแนะนำแสดงครั้งเดียวต่อบัญชี (กดรับทราบแล้วไม่แสดงอีก) เหมือนเว็บจริง
- ลิงก์ Preview / lovable.app ยังแสดงทุกครั้งเหมือนเดิม

## Technical
- `src/utils/previewHost.ts`: return false เมื่อ `Capacitor.isNativePlatform()` เป็น true (ก่อนเช็ค hostname) — ทุกจุดที่ใช้ isPreviewHost (JobActionButtons, AddExpensePage, CurrentJobsPage, SignatureDialog, SettingsPage, PreviewDebugFab) ได้ผลพร้อมกัน
- ปรับกฎใน AGENTS.md: แอป native ไม่นับเป็น preview host
