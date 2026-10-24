# เก็บเงิน COD ผ่าน QR จริง (BOT QR ร้านสหพันธ) — ตามเอกสารฉบับใหม่

## ขั้นที่ 1: ทดสอบสร้าง QR จริงก่อน (ยังไม่แก้หน้าจอ)
- ขอค่าเชื่อมต่อแค่ 2 ค่า: Client ID และ Client Secret (ที่อยู่ API มีในเอกสารแล้ว)
- ทดสอบสร้าง QR ยอด 1 บาท แล้วเช็คสถานะ → รายงานผล: ได้ `payment_id`, รูป QR, เวลาหมดอายุจริงไหม, สถานะ `pending`
- ถ้าไม่ผ่าน แจ้งสาเหตุและหยุดรอ; ถ้าผ่านจึงทำขั้นที่ 2
- QR ทดสอบเป็นรายการจริงของร้าน (ไม่จ่ายก็หมดอายุเอง)

## ขั้นที่ 2: หน้าจอที่จุดส่ง (COD แบบ QR)
- กด "สร้าง QR รับเงิน" → แสดง QR จริง + ยอด + นับถอยหลังตามเวลาหมดอายุที่ระบบส่งมา
- แอปเช็คการโอนเองทุก 4 วินาที ("รอลูกค้าชำระเงิน...")
- โอนสำเร็จ → "ชำระเงินแล้ว" สีเขียว กดยืนยันต่อได้เลย ไม่ต้องแนบรูป
- หมดเวลา/ไม่สำเร็จ → "QR หมดอายุ" + ปุ่ม "สร้าง QR ใหม่" (กดสร้างใหม่ได้ก่อนหมดเวลาด้วย)
- เช็คไม่ได้ → แนบรูปสลิปแล้วกดยืนยันได้ตามเดิม (รูปไม่บังคับสำหรับ QR ถ้าระบบยืนยันแล้ว)
- เงินสด: เหมือนเดิม (บังคับแนบรูป); ข้อความ 4 ภาษา; เลิกใช้ QR ตัวอย่าง

## Technical details
- Secrets: `SAHAPHAN_CLIENT_ID`, `SAHAPHAN_CLIENT_SECRET`; endpoint `https://qbamcmcbmmmsdkzebtbw.supabase.co/functions/v1/public-payment-api` ใส่ในโค้ดฝั่ง server
- Edge function `cod-qr-payment` (มีแล้ว ปรับ): create ส่ง `create_and_process, amount, payment_method: qr_code, qr_provider: bot_qr, shop_id live, description, reference: เลขออเดอร์`; คืน `payment_id, qr_image_url, qr_raw_data, expires_at`; status → `action: status, payment_id`
- แสดง `qr_image_url` ถ้ามี ไม่งั้นสร้างรูปจาก `qr_raw_data` (`qrcode.react`); countdown จาก `expires_at` (fallback 10 นาที)
- `completed` เท่านั้น = จ่ายแล้ว; network error = ลองต่อ; localStorage เก็บ payment_id/expires_at/paid ไม่สร้างซ้ำเอง
- `ready` = cash: รูป≥1; qr: `paid || รูป≥1`; test กติกา ready + map status
