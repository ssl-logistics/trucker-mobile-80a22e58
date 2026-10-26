# แก้ค่า payment_method และทดสอบสร้าง QR ใหม่ (ร้าน Live)

## สิ่งที่จะทำ
1. แก้ระบบสร้าง QR ให้ส่ง payment_method เป็น `qr` (ตอนนี้ส่ง `qr_code`)
2. ทดสอบกับร้าน Live ยอด 1 บาท
   - สร้าง Thai QR
   - สร้าง BOT QR
   - เช็กสถานะของ QR ที่สร้างได้
3. รายงานผล: ได้ QR หรือไม่, เวลาหมดอายุ, สถานะ, เลขใบแจ้งหนี้ (เพื่อแจ้งยกเลิกภายหลัง)

หน้าแอปไม่เปลี่ยน หน้าเก็บเงินด้วย QR ยังใช้แบบเดิมไปก่อน

## Technical details
- `supabase/functions/cod-qr-payment/index.ts`: `payment_method: 'qr_code'` -> `'qr'`, redeploy.
- Test via edge function curl with `shop: 'live'`, `qr_provider` thai_qr / bot_qr, then `action: 'status'` with returned payment_id.
