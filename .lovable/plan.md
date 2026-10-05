# แก้ PATCH สถานะคิว QTruck ที่ตอบ 404

## สาเหตุที่พบ
- การส่ง `update-qtruck-queue-status` ผ่าน key ทั้งสองชั้นแล้ว (ไม่ติด key)
- GET `/queues?external_ref=OR20261006002` เจอคิว `b0f85323-7363-4e57-bf72-0c2b506da6ca`
- แต่ PATCH `/queues/{queue_id}/status` ตอบ 404 "Not found" — น่าจะเป็น id ที่ดึงมาผิด field หรือรูปแบบ URL ไม่ตรงกับที่ QTruck คาด

## แผนแก้ไข (แก้เฉพาะ supabase/functions/update-qtruck-queue-status/index.ts ไฟล์เดียว ไม่แตะ flow เดิม)

1. **เพิ่ม log ผล GET คิวแบบเต็ม** — บันทึก response ดิบจาก GET /queues ลง audit log เพื่อดูว่า queue object มี field id อะไรบ้าง (id, queue_id, queueId ฯลฯ)
2. **ดึง id แบบทนทาน** — ลองอ่านจากหลาย field: `q.id ?? q.queue_id ?? q.queueId` ก่อนส่ง PATCH
3. **ทดสอบยิงจริงอีกครั้ง** — ให้ผู้ใช้เช็คอินงานที่มีคิว แล้วเช็ค log/audit ยืนยันว่า PATCH ตอบ 200

## สิ่งที่ต้องยืนยันกับ QTruck (ถ้าแก้ field แล้วยัง 404)
- รูปแบบ URL ที่ถูกต้องของ PATCH status (ตอนนี้ใช้ `https://xaadsdapeakbcsxfpmtx.supabase.co/functions/v1/external-queue-api/queues/{queue_id}/status` ตามที่ผู้ใช้ให้มา)
- queue_id ที่ใช้ใน path คือ field ไหนจากผล GET /queues

## หมายเหตุ
- ไม่แก้ flow เดิมของแอปเลย — การส่งยังเป็น fire-and-forget เหมือนเดิม
