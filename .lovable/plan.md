# เพิ่มเก็บ log ให้ qtruck-webhook (ไม่แก้พฤติกรรมเดิม)

## เป้าหมาย
เก็บหลักฐานทุกขั้นตอนเพื่อตรวจสอบว่าแจ้งเตือนคิวไม่มาเพราะสาเหตุใด — QTruck ยิงเข้ามาหรือยัง, key ผ่านไหม, หาคนขับเจอไหม, สร้าง notification / ส่ง push สำเร็จหรือไม่

## ข้อจำกัด
- **ไม่เปลี่ยนพฤติกรรมใดๆ ของเส้นเดิม** — ตรวจ key, กันซ้ำ, หาคนขับ, สร้าง notification, ส่ง push, ตอบกลับ เหมือนเดิมทุกอย่าง
- เพิ่มเฉพาะการบันทึก log เท่านั้น

## สิ่งที่จะทำ (แก้ไฟล์เดียว: `supabase/functions/qtruck-webhook/index.ts`)

1. **console.log ทุก request ที่เข้ามา** (ดูได้ใน Logs ของฟังก์ชัน):
   - method, `x-event-type`, `x-event-id`, `external_ref`, `queue_number`, `status`
   - ผลตรวจ key: ผ่าน / ไม่ผ่าน (ไม่ log ค่า key จริง)

2. **บันทึกลงตาราง `edge_function_audit_logs`** (ใช้ helper `writeAuditLog` ที่มีอยู่แล้ว) ทุกเคส:
   - รับ event → payload เต็ม + ผลลัพธ์ (notified / duplicate / driver_not_found / no_notify)
   - key ไม่ผ่าน (401) → บันทึกว่าถูกปฏิเสธ
   - error ภายใน → บันทึก error message
   - ใส่ `order_number` = external_ref เพื่อค้นตามเลขออเดอร์ได้

3. **Log ผลแต่ละขั้น**: กันซ้ำ, หาคนขับ (tracking room / job fallback / ไม่เจอ), insert notification สำเร็จไหม, ส่ง push สำเร็จไหม

## ผลที่ได้
- เห็นทันทีใน Logs ว่ามีการเรียกเข้ามาเมื่อไหร่ event อะไร
- ค้นย้อนหลังใน `edge_function_audit_logs` ได้ว่าแต่ละออเดอร์หลุดที่ขั้นไหน
- ยืนยันได้ว่า QTruck ตั้งค่า URL แล้วยิงมาถูกเส้นจริงหรือไม่

## หลังแก้
- Deploy ฟังก์ชันใหม่ และยิงทดสอบ 1 ครั้งเพื่อยืนยันว่า log ถูกบันทึก (การทดสอบจะสร้าง notification จริง 1 รายการถ้า event ถูกต้อง — จะใช้ event ที่ไม่ก่อให้เกิดแจ้งเตือน เช่น status ที่ไม่แจ้ง)
