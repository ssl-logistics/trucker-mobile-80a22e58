# บันทึกผลการส่งแจ้งเตือน (Push Delivery Log)

## สิ่งที่จะทำ

### 1. ตารางใหม่ `push_delivery_log` ในฐานข้อมูล
เก็บผลการส่งแจ้งเตือนขึ้นมือถือทุกครั้ง ต่อเครื่อง:
- `user_id` — คนขับที่ส่งให้
- `notification_type` — ประเภทแจ้งเตือน (งานใหม่, คิว, สถานะงาน, คืนตู้ ฯลฯ)
- `platform` — ios / android / web
- `success` — ส่งสำเร็จหรือไม่
- `error_message` — เหตุผลที่ล้มเหลว (ถ้ามี) เช่น โทเค็นหมดอายุ
- `token_removed` — โทเค็นถูกลบออกจากระบบหรือไม่
- `title` / `reference_id` — หัวข้อและอ้างอิงงาน (ช่วยค้นย้อน)
- `created_at` — เวลาที่ส่ง

ตั้งค่าสิทธิ์ตามกฎ: GRANT ให้ service_role เต็ม (ตัวส่งใช้ service role), เปิด RLS, อนุญาตให้คนขับอ่านเฉพาะ log ของตัวเอง (SELECT ด้วย auth.uid()) — ไม่ให้แก้/ลบ

### 2. แก้ตัวส่ง `send-push-notification`
- หลังส่งแต่ละเครื่อง (iOS / Android / web push) ให้เขียนผลลง `push_delivery_log` ทันที ทั้งสำเร็จและล้มเหลว
- การเขียน log ต้องไม่ทำให้การส่งหลักล้ม (ถ้าเขียน log ไม่ได้ ให้ข้ามไป ไม่ throw)
- รับ `notification_type` / `reference_id` จากตัวเรียก (ถ้าไม่ส่งมา ใช้ค่าว่าง)

### 3. ตัวเรียกส่งข้อมูลประกอบ
- `check-new-jobs`, `receive`, `receive-job-status`, `qtruck-webhook`, `notify-container-return-deadline`, `notify-booking-closing-date` — ส่ง `notification_type` และ `reference_id` ติดไปกับคำสั่งส่ง push เพื่อให้ log ระบุได้ว่าเป็นแจ้งเตือนอะไร ของงานไหน

### 4. ทดสอบ
- ส่ง push ทดสอบให้บัญชีทดสอบ แล้วอ่าน `push_delivery_log` ยืนยันว่ามีแถวบันทึก สถานะถูกต้อง
- ทดสอบกรณีล้มเหลว (โทเค็นใช้ไม่ได้) ว่ามีบันทึก error_message

## สิ่งที่ไม่แตะ
- เงื่อนไขการแจ้งเตือนงานใหม่เดิม, flow เช็คอิน/SOP/POD, การเงิน, เมนูเอกสาร
- ตรรกะการส่ง push เดิม (เพิ่มเฉพาะการบันทึกผล)

## รายละเอียดทางเทคนิค
- Migration ผ่าน lov_database--migration: CREATE TABLE + GRANT + ENABLE RLS + POLICY ใน migration เดียว
- แก้ `supabase/functions/send-push-notification/index.ts` และไฟล์ caller 6 ไฟล์
- Deploy `send-push-notification` และ caller ที่แก้ แล้วทดสอบด้วย curl_edge_functions + อ่านตารางยืนยัน
