# อัปเดตสถานะคิว QTruck ตอนเช็คอิน / ยืนยัน SOP

## คำตอบคำถาม
ใช่ครับ `queue_id` มากับข้อมูลคิวอยู่แล้ว — `get-qtruck-queue` คืน `queue.id` กลับมาเสมอ แต่เพื่อความชัวร์ฝั่งแอปจะส่งแค่ `order_number` แล้วให้ edge function ไปหา queue ที่ active อยู่เอง (กันเคส id เก่าค้างใน state)

## สิ่งที่จะทำ

### 1. Edge function ใหม่: `update-qtruck-queue-status`
- รับ `{ order_number, status }` (status = `processing` หรือ `completed` เท่านั้น)
- ตรวจ `x-app-secret` เหมือน `get-qtruck-queue`
- เรียก GET `/queues?external_ref={order_number}` ด้วย `x-api-key: QTRUCK_API_KEY` เพื่อหา queue ที่ยัง active
- ถ้าเจอ → PATCH `/queues/{queue_id}/status` body `{ "status": ... }`
- ถ้าไม่เจอคิว → ตอบ success:false แบบเงียบ (ไม่ทำให้ flow หลักพัง)
- บันทึก audit log ลง `edge_function_audit_logs` ทุกครั้ง (ตรวจย้อนหลังได้)

### 2. เรียกตอนเช็คอินถึงจุดต้นทาง → `processing`
- หลัง `driverCheckin` สำเร็จในหน้าเช็คอินต้นทาง (SOPCheckInPage / ContainerCheckInPage)
- เรียกเฉพาะงานที่มี `has_qtruck_booking`
- แบบ fire-and-forget (ไม่ block หน้าจอ, fail แล้วแค่ console.warn)

### 3. เรียกตอนยืนยัน SOP สำเร็จ → `completed`
- หลัง `driverSop` สำเร็จใน SOPCheckInPage (และ ContainerSOPPage ถ้ามี flow ยืนยันต้นทาง)
- เงื่อนไขเดียวกัน: เฉพาะงาน `has_qtruck_booking`, fire-and-forget

## ไม่แตะต้อง
- flow เช็คอิน/SOP เดิม, webhook, JobQueueDialog

## ทดสอบ
- ยิง edge function ด้วย order จริงที่มีคิว → เช็ค audit log + สถานะคิวฝั่ง QTruck
