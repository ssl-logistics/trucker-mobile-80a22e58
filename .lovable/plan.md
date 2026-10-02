# ดึงข้อมูลคิว QTruck จริง + แจ้งเตือนเมื่อใกล้ถึงคิว

## 1. ดึงคิวจริงเมื่อกดปุ่มคิว
- กดปุ่ม **คิว** (เฉพาะงานที่ has_qtruck_booking เป็นจริง ตามเดิม) → เปิดป๊อปอัปพร้อมสถานะกำลังโหลด
- เรียกเส้นใหม่ของแอป `get-qtruck-queue` (ตัวกลาง เก็บรหัสไว้ฝั่งเซิร์ฟเวอร์) ส่งเลขออเดอร์
- ตัวกลางยิง `GET https://xaadsdapeakbcsxfpmtx.supabase.co/functions/v1/external-queue-api/queues?external_ref={เลขออเดอร์}` แล้วใช้ `queue.id` เรียก `GET /external-queue-api/queues/{queue_id}` เพื่อเอาคิวก่อนหน้า/จำนวนคิวที่รอ
- ป๊อปอัปแสดงค่าจริง: คิวของฉัน (`queue_number`), สถานะ (waiting/called/processing/completed/cancelled/moved แปล 4 ภาษา), คิวที่กำลังให้บริการ, เหลือก่อนถึงคิว, ประตู (gate) และช่วงเวลา (slot date start-end)
- ไม่พบคิว / ระบบขัดข้อง → แสดงข้อความ "ยังไม่มีข้อมูลคิว" แทนค่าตัวอย่าง
- ขณะเปิดป๊อปอัปค้างไว้ รีเฟรชทุก 60 วินาที

## 2. เส้นรับแจ้งเตือนจาก QTruck (Webhook)
- สร้างเส้นใหม่ `qtruck-webhook` (POST) — URL ให้ส่งต่อ QTruck ตั้งเป็น TRUCKER_WEBHOOK_URL
- ตรวจ header `x-api-key` ต้องตรงกับรหัส `TRUCKER_API_KEY` (มีอยู่แล้ว) ไม่ตรงตอบ 401
- กันรับซ้ำด้วย `x-event-id` (ตารางบันทึก event ที่รับแล้ว)
- หาคนขับจาก `queue.external_ref` (เลขออเดอร์) → บันทึกแจ้งเตือนในแอป + ส่ง push ให้คนขับคนนั้น:
  - `queue.upcoming`: "อีก {threshold_minutes} นาทีถึงคิว {queue_number} (ประตู {gate})"
  - `queue.called`: "ถึงคิวแล้ว! เชิญเข้าประตู {gate}"
  - `queue.status_changed`: แจ้งเฉพาะ moved / cancelled
- กดแจ้งเตือนแล้วพาไปหน้างานนั้น (ใช้ reference_id = เลขออเดอร์ ตามระบบเดิม)
- ตอบ 200 ภายในเวลาเสมอ

## 3. ป๊อปอัปกลางจอ + แจ้งเตือนขึ้นมือถือ
- **แจ้งเตือนบนมือถือ**: ส่ง push ผ่านระบบแจ้งเตือนเดิมของแอป (ขึ้นแม้ปิดแอปอยู่)
- **ป๊อปอัปกลางจอ**: ขณะเปิดแอปอยู่หน้าไหนก็ได้ เมื่อมีแจ้งเตือนคิวใหม่ จะเด้งกล่องกลางจอทันที (พื้นหลังทึบ) แสดง:
  - หัวข้อ "ใกล้ถึงคิวแล้ว" / "ถึงคิวแล้ว!" / "คิวถูกย้าย" / "คิวถูกยกเลิก"
  - เลขคิว, ประตู, ช่วงเวลา, เลขออเดอร์, อีกกี่นาที
  - ปุ่ม **ดูคิว** (เปิดป๊อปอัปคิวของงานนั้น) และ **ปิด**
- ตรวจหาแจ้งเตือนคิวใหม่ทุก 15 วินาที + ทันทีเมื่อกด push หรือกลับเข้าแอป; แสดงครั้งเดียวต่อแจ้งเตือน (จำว่าแสดงแล้ว)
- ถึงคิว (`queue.called`) สั่นเครื่องเพิ่ม

## รายละเอียดทางเทคนิค
- Edge functions: `get-qtruck-queue` (verifyAppSecret, ส่ง `x-api-key`), `qtruck-webhook` (verify_jwt=false)
- ตารางใหม่ `qtruck_webhook_events (event_id text pk, event_type, external_ref, payload jsonb, created_at)` + GRANT service_role + RLS
- หาคนขับจากเลขออเดอร์: ค้นตาราง tracking room / ข้อมูลงานที่มี driver_id ของออเดอร์นั้น
- แก้ `JobQueueDialog.tsx` (loading / empty / status / gate / slot), `CurrentJobsPage.tsx` (เรียกเมื่อกดปุ่ม), `LanguageContext.tsx` (ข้อความ 4 ภาษา)

## ต้องยืนยัน
- รหัส `x-api-key` สำหรับเรียก QTruck ใช้ตัวเดียวกับ `TRUCKER_API_KEY` หรือเป็นรหัสแยก — ถ้าแยกจะขอให้กรอกเพิ่ม
