# ปรับ qtruck-webhook ให้ตรงเอกสาร QTruck v1.2

## สิ่งที่ตรงอยู่แล้ว (ไม่ต้องแก้)
- รับ POST JSON + ตรวจ `x-api-key`, ตอบ 2xx ทันที
- กันรับซ้ำด้วย `x-event-id` (ตาราง `qtruck_webhook_events`)
- รองรับ 3 event: `queue.upcoming` (ใช้ `threshold_minutes` ในข้อความ), `queue.called`, `queue.status_changed` (moved/cancelled)
- สร้าง notification ประเภท `qtruck_queue` + ส่ง push หาคนขับ

## จุดที่ขาด / ไม่ตรงเอกสาร

### 1. Key ที่ใช้ตรวจไม่ตรงเอกสาร
เอกสารระบุ `x-api-key` = **TRUCKER_API_KEY** แต่โค้ดตรวจเทียบกับ **QTRUCK_API_KEY** เท่านั้น
- แก้: ยอมรับได้ทั้งสองค่า (เทียบกับ `QTRUCK_API_KEY` หรือ `TRUCKER_API_KEY`) — ไม่ว่าฝั่ง QTruck จะตั้งค่าด้วย key ไหนก็ผ่าน ไม่ต้องแก้ฝั่งเขา

### 2. หาคนขับไม่เจอถ้ายังไม่มี tracking room
ตอนนี้หา `driver_id` จาก `order_tracking_rooms` เท่านั้น — ถ้าคิวถูกเรียกก่อนคนขับกดเริ่มงาน (ยังไม่มี room) แจ้งเตือนจะหลุด
- แก้: เพิ่มทางสำรอง ค้นคนขับจากข้อมูลงาน (driver ที่ถูก assign ให้ order นั้น) ก่อนตอบ `driver_not_found`

### 3. ไม่แจ้งตอนสถานะ `completed`
เอกสารระบุ `completed` = เสร็จแล้ว หยุดติดตามได้ — ตอนนี้ไม่แจ้งอะไรเลย
- แก้: เพิ่มข้อความแจ้ง "คิวเสร็จสิ้น" เมื่อ `status_changed` → `completed` (ไม่เพิ่ม `processing` เพื่อไม่ให้แจ้งรัวเกิน)

## ไฟล์ที่แก้
- `supabase/functions/qtruck-webhook/index.ts` (ไฟล์เดียว) แล้ว deploy ใหม่

## หมายเหตุ
- ฝั่ง QTruck พร้อมส่งแล้ว รอแค่เราส่ง URL เส้นรับไปให้เขาตั้งค่า: `https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/qtruck-webhook` (event ที่ค้างอยู่จะถูกส่งมาทันทีหลังตั้งค่า)
