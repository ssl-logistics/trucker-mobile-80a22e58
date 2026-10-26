# ส่งวิธีจ่าย COD ให้ระบบหลักแบบชัดเจน

## ตอนนี้
ยังไม่ได้บอกเป็นช่องชัดเจน: `payment_method` ส่งเป็น `cod` ทุกครั้ง วิธีจ่ายจริงอยู่แค่ในข้อความ `notes` (เงินสด / QR โค้ก / QR Mint) และมี `qr_payment_id` เฉพาะ QR Mint ที่จ่ายสำเร็จ

## จะแก้
ตอนส่งเก็บเงิน (driver-checkin, checkin_type: payment) เพิ่มช่อง `cod_method` ส่งค่า:
- `cash` = เงินสด
- `static_qr` = QR โค้ก
- `mint_qr` = QR Mint (พร้อม `qr_payment_id` ถ้าจ่ายสำเร็จ)

`payment_method: 'cod'` และ `notes` ส่งเหมือนเดิม ระบบเก่าจึงไม่พัง
ระบบหลักต้องเพิ่มการรับช่อง `cod_method` ด้วย ถ้ายังไม่รองรับ ค่านี้จะถูกข้ามไปเฉยๆ

## Technical details
- `src/lib/externalApi.ts`: add optional `cod_method?: 'cash' | 'static_qr' | 'mint_qr'` to the driverCheckin payload type.
- `DeliveryDetailPage.tsx` payment check-in: add `cod_method: codState.method || 'cash'`.
