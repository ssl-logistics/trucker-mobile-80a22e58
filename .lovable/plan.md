# เก็บเงิน COD ผ่าน QR จริง (BOT QR ร้านสหพันธ) ที่จุดส่ง

## สิ่งที่คนขับจะเห็น
- งานจุดส่งที่ COD แบบ QR: กด "สร้าง QR รับเงิน" → แสดง QR จริงตามยอด COD + ยอดเงิน + นับเวลาถอยหลัง (เช่น 09:59)
- ระหว่างรอ แอปเช็คการโอนเองทุก 4 วินาที ขึ้นข้อความ "รอลูกค้าชำระเงิน..."
- โอนสำเร็จ → ขึ้น "ชำระเงินแล้ว" สีเขียว ปิด QR อัตโนมัติ และกดยืนยันส่งงานต่อได้เลย **ไม่ต้องแนบรูป**
- หมดเวลา / ไม่สำเร็จ → ขึ้น "QR หมดอายุ" พร้อมปุ่ม "สร้าง QR ใหม่" (กดสร้างใหม่ได้ตลอดก่อนหมดเวลาด้วย)
- เช็คไม่ได้ (ระบบชำระเงินขัดข้อง หรือลูกค้าโอนทางอื่น) → แนบรูปสลิปแล้วกดยืนยันได้ตามเดิม
- กติกาปุ่มยืนยัน (QR): ผ่านได้ถ้า ระบบยืนยันชำระแล้ว **หรือ** แนบรูปอย่างน้อย 1 รูป — รูปไม่บังคับอีกต่อไปสำหรับ QR
- เงินสด: เหมือนเดิม (บังคับแนบรูป)
- ข้อความทั้งหมดรองรับ ไทย/อังกฤษ/จีน/เกาหลี
- ยกเลิก QR ตัวอย่าง (mock) และปุ่ม "ยืนยันรับเงินแล้ว" ที่กดเองได้

## สิ่งที่ต้องขอจากคุณ
ค่าเชื่อมต่อระบบชำระเงิน 3 ค่า (เก็บไว้ฝั่งเซิร์ฟเวอร์ ไม่อยู่ในแอป): URL ของ API, Client ID, Client Secret (ต้องมีสิทธิ์ payments.create และ payments.read)

## Technical details
- Secrets: `SAHAPHAN_PAYMENT_API_URL`, `SAHAPHAN_CLIENT_ID`, `SAHAPHAN_CLIENT_SECRET` (add_secret)
- Edge function ใหม่ `cod-qr-payment` (CORS รวม `x-app-secret`, zod validate): `action: create` → POST `create_and_process` (mode live, bot_qr, shop_id `581c4aa6-cd23-432d-a60e-748111e0514a`, amount บาท) คืน `payment_id, qr_code`; `action: status` → POST `status` ด้วย payment_id; Basic Auth ฝั่ง server
- `CodCollectSection.tsx`: แทน MockQr ด้วย QR จริงจาก `qr_code` (ไลบรารี `qrcode.react`); countdown 10 นาที (API ไม่ระบุเวลาหมดอายุ — หยุดเมื่อได้ `expired`/`failed` ก่อนก็ได้); poll 4s, network error = ลองต่อ ไม่ถือว่าไม่จ่าย; `completed` เท่านั้นที่นับว่าจ่าย
- state ที่เก็บใน localStorage: `paymentId, qrCode, expiresAt, paid` — กลับเข้าหน้าเดิมใช้ payment_id เดิมเช็คต่อ ไม่สร้างซ้ำ; สร้างใหม่เฉพาะเมื่อกดเอง
- `ready` = cash: urls≥1; qr: `paid || urls≥1`; ส่ง `payment_id` ไปกับข้อมูลเช็คอิน COD ถ้ามี
- เพิ่ม test: กติกา ready (QR จ่ายแล้วไม่มีรูป = ผ่าน, QR ไม่จ่ายไม่มีรูป = ไม่ผ่าน, เงินสดไม่มีรูป = ไม่ผ่าน) และ map status (`completed` เท่านั้น = paid)
