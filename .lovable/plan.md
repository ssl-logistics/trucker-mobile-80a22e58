# แจ้งเตือนคิว QTruck รองรับ 4 ภาษา (th/en/ko/zh)

## ปัญหา
ตอนนี้ qtruck-webhook บันทึกแจ้งเตือนเฉพาะ `title_th/title_en` และ `description_th/description_en` — คนขับที่ใช้ภาษาเกาหลีหรือจีนจะเห็นข้อความภาษาไทย (หน้าแจ้งเตือน fallback กลับไปที่ title_th)

## การเปลี่ยนแปลง
แก้ไฟล์เดียว: `supabase/functions/qtruck-webhook/index.ts`

- เพิ่มข้อความภาษาเกาหลี (ko) และจีน (zh) ให้ครบทุก event:
  - `queue.upcoming` — "ใกล้ถึงคิวแล้ว" + รายละเอียดนาที/คิว/ประตู/จำนวนคิวข้างหน้า
  - `queue.called` — "ถึงคิวแล้ว!"
  - `queue.status_changed` — moved / cancelled / completed / processing (เพิ่ม STATUS_KO, STATUS_ZH)
- ข้อความต่อท้าย "โรงงาน" / "ทะเบียน" เพิ่มเวอร์ชัน ko/zh ด้วย
- บันทึกลงคอลัมน์ `title_ko`, `title_zh`, `description_ko`, `description_zh` ของตาราง notifications (หน้า NotificationsPage รองรับการแสดง 4 ภาษาอยู่แล้ว ไม่ต้องแก้ฝั่งแอป)
- push notification บนมือถือยังส่งภาษาไทยเหมือนเดิม (ไม่แตะ flow เดิม)

## หมายเหตุทางเทคนิค
- แปล ko/zh แบบตายตัวในฟังก์ชัน (ข้อความสั้น คงที่) ไม่ต้องเรียก AI แปล
- โครงสร้างการทำงานอื่นของ webhook (กันซ้ำ, หาคนขับ, 503 retry, audit log) คงเดิมทั้งหมด
