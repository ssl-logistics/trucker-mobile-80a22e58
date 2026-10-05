# แก้การส่งสถานะคิว QTruck (ตอบ 404) — ส่ง external_ref ใน body

## สาเหตุที่พบ
- ไม่ติด key — ผ่านทั้งสองชั้น
- PATCH `/queues/{queue_id}/status` ด้วย queue_id ที่ได้จาก GET ตอบ 404 "Not found"

## แผนแก้ไข (แก้เฉพาะ supabase/functions/update-qtruck-queue-status/index.ts ไฟล์เดียว ไม่แตะ flow เดิม)

1. ไม่ต้อง GET หาคิวก่อนแล้ว — ส่ง PATCH ตรงด้วย body:
   ```json
   { "external_ref": "OR20261006002", "status": "processing" }
   ```
   (status = processing ตอนเช็คอินต้นทาง, completed ตอนยืนยัน SOP)
2. Header ยังคงส่งแค่ `x-api-key` (QTRUCK_API_KEY) เหมือนเดิม
3. บันทึก audit log ทุกครั้ง (body ที่ส่ง + response จาก QTruck) เพื่อตรวจสอบ
4. Deploy แล้วให้ผู้ใช้ทดสอบเช็คอิน/ยืนยัน SOP อีกครั้ง แล้วเช็ค log ยืนยันว่าตอบ 200

## สมมติฐานที่ต้องยืนยัน
- URL ปลายทาง: ใช้ `.../external-queue-api/queues/status` (ไม่มี queue_id ใน path) — ถ้า QTruck ใช้ path อื่น บอกได้เลยครับ

## หมายเหตุ
- ฝั่งแอปไม่แก้อะไร — ยังส่งแบบ fire-and-forget เหมือนเดิม
