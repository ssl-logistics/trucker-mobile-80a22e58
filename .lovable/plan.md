# เพิ่มเมนู "แจ้งซ่อม" + หน้าแจ้งซ่อมใหม่ ส่งเข้า API ระบบหลัก

## 1. หน้าตั้งค่า — เมนูแจ้งซ่อม
- เพิ่มแถวเมนู **แจ้งซ่อม** ในหมวด "ทั่วไป" ของหน้าตั้งค่า (SettingsPage) อยู่ใต้ "แจ้งเตือน" พอดี
- ใช้แถวเมนูปกติแต่ไอคอนเด่น (สีส้ม/แดง, ไอคอนรูปเครื่องมือ/รายงาน) เปิดหน้ามาเห็นทันที ไม่ต้องเลื่อนหา
- กด → เปิดหน้าใหม่ `/repair-report`

## 2. หน้าแจ้งซ่อมใหม่ (RepairReportPage)
หน้าตาตามระบบแอปเดิม (หัวเรื่อง + ปุ่มย้อนกลับ) มี:
- **ทะเบียนรถ** — ดึงจากข้อมูลคนขับ (plate_number + plate_province, สำรอง `auth_truck_plate`) กรอกล่วงหน้า แก้ได้ ถ้าไม่มีให้กรอกเอง (บังคับ)
- **รายละเอียดปัญหา** — ช่องพิมพ์ (บังคับในแอป)
- **แนบรูป/คลิป** — สูงสุด 10 ไฟล์, ไฟล์ละไม่เกิน 20MB, รับทั้งรูปและวิดีโอ (รองรับกล้อง/แกลเลอรีบนมือถือเหมือนหน้าอื่น) แสดงตัวอย่าง + ลบได้
- **ตำแหน่ง GPS** — จับอัตโนมัติตอนเปิดหน้า (ถ้าไม่อนุญาตให้ผ่านได้ เป็นค่าไม่บังคับ)
- กดส่ง → โหลดดิ้ง → สำเร็จแสดงแจ้งเตือน "ส่งเรียบร้อย" แล้วกลับหน้าเดิม
- ข้อความทั้งหมด 4 ภาษา (ไทย/อังกฤษ/เกาหลี/จีน)

## 3. ส่งข้อมูลเข้า API ระบบหลัก
- แอปเรียกเส้นตัวกลางใหม่ `report-vehicle-maintenance` (Edge Function เก็บรหัสไว้ฝั่งเซิร์ฟเวอร์)
- ตัวกลางยิงต่อ `POST https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/report-vehicle-maintenance` ด้วย `x-api-key` ตัวเดียวกับเส้นแจ้งปัญหาแอป (EXPRESS_RENT_API_KEY)
- Body ที่ส่ง: `license_plate`, `driver_id`, `driver_type` (internal/external/freelance แปลงจาก userType เดิม), `driver_name`, `note`, `latitude`, `longitude`, `photos_base64[]` = `{data, content_type, file_name}` (base64 พร้อม prefix)
- สำเร็จ → ส่งกลับ success ให้แอป ไม่สำเร็จ → แสดงข้อผิดพลาดจาก API

## รายละเอียดทางเทคนิค
- ไฟล์ใหม่: `src/pages/RepairReportPage.tsx`, `supabase/functions/report-vehicle-maintenance/index.ts`
- แก้: `src/pages/SettingsPage.tsx` (เมนู), `src/App.tsx` (route), `src/contexts/LanguageContext.tsx` (4 ภาษา), `roadmap.md`
- ไม่แตะโครงสร้างเส้น API อื่น, ไม่เก็บรหัส API ในโค้ดฝั่งหน้าเว็บ
- ตรวจ: `bunx tsgo --noEmit`, build log, ทดสอบหน้าจอด้วย Playwright (เมนูโชว์, ฟอร์มกรอกได้, กดส่งยิงตัวกลาง)
