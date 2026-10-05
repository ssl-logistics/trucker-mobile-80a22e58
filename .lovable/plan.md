# เพิ่มเก็บ log ให้ qtruck-webhook

## เป้าหมาย
ดูย้อนหลังได้ว่า QTruck ยิง webhook เข้ามาหรือยัง ยิงอะไรมา และระบบประมวลผลถูกต้องไหม — โดยไม่กระทบการทำงานเดิม

## สิ่งที่จะทำ (แก้ไฟล์เดียว: `supabase/functions/qtruck-webhook/index.ts`)

1. **Log ทุก request ที่เข้ามา** (console.log — ดูได้ใน Logs ของฟังก์ชัน):
   - เวลา, method, `x-event-type`, `x-event-id`, `external_ref` (เลขออเดอร์), `queue_number`, `status`
   - ผลตรวจ key: ผ่าน / ไม่ผ่าน (ไม่ log ค่า key จริง)

2. **บันทึกลงตาราง `edge_function_audit_logs`** (ใช้ helper `writeAuditLog` ที่มีอยู่แล้วใน `_shared/auditLog.ts`) ทุกเคส:
   - รับ event สำเร็จ → บันทึก payload เต็ม + ผลลัพธ์ (notified / duplicate / driver_not_found)
   - key ไม่ผ่าน (401) → บันทึกว่าถูกปฏิเสธ
   - error ภายใน → บันทึก error message
   - ใส่ `order_number` = external_ref เพื่อค้นหาตามเลขออเดอร์ได้

3. **Log ผลแต่ละขั้นตอน**: กันซ้ำ (duplicate), หาคนขับเจอ/ไม่เจอ (จาก tracking room หรือ job fallback), สร้าง notification สำเร็จไหม, ส่ง push สำเร็จไหม

## ผลที่ได้
- เปิด Logs ของฟังก์ชัน `qtruck-webhook` เห็นทันทีว่ามีการเรียกเข้ามาเมื่อไหร่ จาก event อะไร
- ค้นย้อนหลังในตาราง `edge_function_audit_logs` ได้ว่าแต่ละออเดอร์ได้รับแจ้งเตือนคิวหรือไม่ เพราะอะไร
- ช่วยยืนยันตอน QTruck ตั้งค่า URL แล้วว่ายิงมาถูกเส้นจริง

## หมายเหตุ
- ไม่เปลี่ยนพฤติกรรมเดิม (ยังตอบ 200 ทันที, กันซ้ำ, แจ้งเตือนเหมือนเดิม)
- หลังแก้จะ deploy ฟังก์ชันใหม่และยิงทดสอบ 1 ครั้งเพื่อยืนยันว่า log ถูกบันทึก
