# แผน: แจ้งเตือนคิว QTruck แสดงชื่อโรงงานต้นทาง + ทะเบียนรถ

## สิ่งที่จะทำ

เพิ่มข้อมูล 2 อย่างในข้อความแจ้งเตือนคิว (ทั้งป๊อปอัปในแอป รายการแจ้งเตือน และ push notification):

1. **ชื่อโรงงานต้นทาง** — ดึงจาก payload ของ QTruck ก่อน (เช่น `factory.name` / `site.name` ถ้ามี) ถ้าไม่มีให้ค้นจากตาราง jobs ด้วยเลขออเดอร์ (`origin_company_name` หรือ `employer_name`)
2. **ทะเบียนรถ** — ดึงจากทะเบียนรถของคนขับที่ล็อกอินอยู่ (ตาราง vehicles ของ driver คนนั้น เลือกคันล่าสุด)

ตัวอย่างข้อความหลังแก้ (queue.called):
- ไทย: `คิว 2 เชิญเข้าประตู GATE4 · โรงงาน: บจก.ตัวอย่าง · ทะเบียน: 70-1234`
- อังกฤษ: `Queue 2, please proceed to Gate GATE4 · Factory: Example Co. · Plate: 70-1234`

ใช้กับทุก event ที่แจ้งเตือน: queue.upcoming, queue.called, queue.status_changed (moved/cancelled/completed/processing)

## รายละเอียดทางเทคนิค

- แก้ไฟล์เดียว: `supabase/functions/qtruck-webhook/index.ts`
- หลังหา driverId ได้แล้ว:
  - query `vehicles` where `driver_id = driverId` order by created_at desc limit 1 → เอา `plate_number` (+ `plate_province` ถ้ามี)
  - โรงงาน: อ่านจาก `body?.factory?.name ?? body?.site?.name ?? q?.factory_name` ก่อน; ถ้าไม่มีและมี orderNumber → query `jobs` by `order_code` เอา `origin_company_name ?? employer_name`
- ต่อท้าย description_th/description_en ด้วย ` · โรงงาน: X · ทะเบียน: Y` (เฉพาะค่าที่หาเจอ — ถ้าไม่เจอไม่แสดงส่วนนั้น)
- เก็บ factory_name / truck_plate ลง audit log (response_body) ด้วยเพื่อตรวจสอบย้อนหลัง
- ไม่แตะ flow อื่น, ไม่แก้หน้า UI (ป๊อปอัปแสดง description อยู่แล้ว ข้อมูลใหม่จะโผล่เองทั้งป๊อปอัปและ push)
- deploy function แล้วรอ user ยิงเทสจาก QTruck อีกครั้งเพื่อเช็ค log
