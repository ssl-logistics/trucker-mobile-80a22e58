# ปรับ qtruck-webhook ให้ตรงเอกสาร QTruck v2 (Queue Status Webhook)

## เทียบเอกสารแล้ว — ตรงอยู่แล้ว (ไม่แก้)
- รับ POST JSON, ตรวจ `x-api-key` (รับทั้ง TRUCKER_API_KEY / QTRUCK_API_KEY), ตอบ 2xx ทันที
- กันรับซ้ำด้วย `x-event-id` (ตาราง `qtruck_webhook_events`) — ตรงข้อ 5 ของเอกสาร
- `queue.upcoming` ใช้ `threshold_minutes` (15/10/5) ในข้อความ — ตรงเอกสาร
- `queue.called` และ `queue.status_changed` (moved / cancelled / completed) แจ้งเตือนครบ
- เก็บ audit log ทุกเคสแล้ว (ไว้ดูสาเหตุที่แจ้งเตือนไม่มา)

## จุดที่ต้องแก้ตามเอกสารฉบับใหม่

### 1. หาคนขับด้วยเบอร์โทรเมื่อไม่มี external_ref (สาเหตุที่เทสล่าสุดไม่แจ้ง)
เอกสารระบุชัดว่า `external_ref` เป็น `null` ได้ถ้าคิวไม่ได้จองผ่าน API ทัคเกอร์ — และเทสล่าสุดหลุดตรงนี้พอดี
- แก้: ถ้าไม่มี `external_ref` หรือหาคนขับจากออเดอร์ไม่เจอ ให้หาคนขับจาก `queue.driver_phone` เทียบกับ `profiles.phone_number` (รองรับเบอร์มี/ไม่มี 0 นำหน้า)
- ถ้ายังไม่เจอค่อยตอบ `driver_not_found` พร้อม log เหมือนเดิม

### 2. รองรับสถานะครบตามตารางเอกสาร
เอกสารกำหนด 6 สถานะ: waiting / called / processing / completed / cancelled / moved
- เพิ่มข้อความแจ้ง `processing` ("กำลังขึ้น/ลงสินค้า") ให้ตรงเอกสาร — ครั้งเดียวต่อการเปลี่ยนสถานะ ไม่รัว เพราะ QTruck ส่งเฉพาะตอนสถานะเปลี่ยน
- `waiting` ไม่ต้องแจ้ง (เป็นแค่สถานะตั้งต้นของ queue.upcoming ซึ่งแจ้งอยู่แล้ว)

### 3. เก็บข้อมูลประกอบจาก payload ใหม่ (ใช้ในข้อความ/log)
- `queue.upcoming`: แสดง `queues_ahead` (เหลือกี่คิวข้างหน้า) ในข้อความแจ้งเตือนด้วย
- เก็บ `estimated_call_at`, `slot` (วันที่/เวลา), `gate.name` ลง audit log เพื่อตรวจย้อนหลัง

## ไฟล์ที่แก้
- `supabase/functions/qtruck-webhook/index.ts` (ไฟล์เดียว) แล้ว deploy ใหม่

## หลังแก้
- ผู้ใช้จะทดสอบยิง webhook อีกครั้ง — ผมเช็ค log ยืนยันผลให้หลังเทส
