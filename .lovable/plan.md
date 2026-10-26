# ใช้ QR จริงตอนเก็บเงิน COD แบบ QR (หน้าส่งสินค้า)

## สิ่งที่คนขับจะเห็น
1. จุดส่งที่เก็บเงินแบบ QR: กด "เปิด QR รับเงิน" แล้วแอปจะสร้าง QR จริงตามยอด COD ของจุดนั้น (ร้าน Live, แบบ Thai QR)
2. ในหน้าต่าง QR จะมี
   - รูป QR ให้ลูกค้าสแกน และยอดเงิน
   - เวลานับถอยหลังตามเวลาหมดอายุที่ระบบสหพันธ์ส่งมา (ประมาณ 10 นาที)
   - สถานะ "รอชำระ..." ที่แอปเช็กให้ทุก 4 วินาที
3. ลูกค้าจ่ายสำเร็จ: ขึ้น "รับเงินผ่าน QR แล้ว" สีเขียว ปิดหน้าต่างเอง และกดยืนยันส่งได้โดยไม่ต้องแนบรูป
4. QR หมดอายุ: ขึ้น "QR หมดอายุ" พร้อมปุ่ม "สร้าง QR ใหม่"
5. สร้าง QR หรือเช็กสถานะไม่ได้: แอปแจ้งเตือน แล้วให้กลับไปทำแบบเดิม คือแนบรูปสลิปแล้วยืนยัน
6. เงินสดยังต้องแนบรูปเหมือนเดิม
7. ข้อความรองรับ 4 ภาษา (ไทย อังกฤษ จีน เกาหลี)

ถ้าออกจากหน้าแล้วกลับมาใหม่ระหว่างที่ QR ยังไม่หมดอายุ แอปจะแสดง QR เดิมต่อ ไม่สร้างใหม่

## Technical details
- `cod-qr-payment` edge function: default `shop` to live, `qr_provider` thai_qr (returns `qrCodeUrl` image). Map paid status: `paymentStatus`/`kbank_status` = PAID/SUCCESS/COMPLETED → `paid: true` (note: outer `data.status` "SUCCEEDED" means the API call succeeded, not payment; use paymentStatus). Fall back to rendering `qr_raw_data` with a QR library (`qrcode.react`) when no image URL.
- New `src/lib/codQr.ts`: `createCodQr(amount, ref)`, `checkCodQr(paymentId)`, `isQrPaid(status)`, `secondsLeft(expiresAt, now)`; unit tests for paid detection + countdown.
- `CodCollectSection.tsx`: replace MockQr dialog with real QR, 4s polling while open & pending, countdown, regenerate on expiry; persist `{paymentId, qrImage, qrRaw, expiresAt, paid}` in existing storageKey state. `ready = paid || urls.length > 0` for QR; on create/status failure show fallback message and require photo (current behavior). Cash unchanged.
- Save `payment_id` with the COD check-in payload alongside existing COD fields if the payload already carries COD metadata.
