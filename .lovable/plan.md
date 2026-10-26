# เคลียร์ยอดผ่าน QR Mint + ส่งเลขอ้างอิง (payment_id ของ Mint)

## สิ่งที่จะเห็น
**หน้าต่างเคลียร์ยอด** มี 2 แท็บ:
- **แนบสลิป** (ค่าเริ่มต้น เหมือนเดิม): แนบรูป ตรวจยอด แล้วกดยืนยันเคลียร์ยอด
- **QR Mint**: แสดง QR ตามยอดที่ต้องเคลียร์ทันที มีนับถอยหลัง และเช็คสถานะทุก 4 วินาที เมื่อจ่ายแล้วจะแสดง "ชำระแล้ว" พร้อมเลขอ้างอิง ระบบหลักบังคับให้แนบรูปอย่างน้อย 1 รูปเสมอ จึงยังต้องแนบรูป (เช่น ภาพหน้าจอ) ก่อนกดยืนยัน เมื่อจ่ายแล้วจะล็อกไม่ให้สลับแท็บ

**เลขอ้างอิง = payment_id ของ Mint** ที่ได้จากผลเช็คสถานะตอนจ่ายสำเร็จ (เช่น 33962211-e2e7-43ad-b76f-d206b282f642)
- จุดส่งลูกค้า: เมื่อลูกค้าจ่ายด้วย QR Mint ส่ง `cod_reference` = payment_id ไปกับเช็คอิน และแสดงเลขนี้ในกล่อง COD กับกล่องสรุป COD ของจุดที่ส่งเสร็จแล้ว
- เคลียร์ยอดผ่าน QR Mint: ส่ง `clear_method: "mint_qr"` และ `clear_reference` = payment_id
- แท็บแนบสลิป: ไม่ส่ง clear_method หรือ reference (เหมือนเดิม)
- การ์ดของงานที่เคลียร์แล้ว: แสดงช่องทางที่เคลียร์ (QR Mint / เงินสด / QR โค้ก) และเลขอ้างอิง ถ้าระบบหลักส่งค่ากลับมา

## รายละเอียดทางเทคนิค
- `externalApi.driverCheckin` payload: เพิ่ม `cod_reference?: string` (ไม่เกิน 200 ตัวอักษร); `DeliveryDetailPage` ส่งค่าเป็น `codState.qrPaymentId` เมื่อ method เป็น mint_qr
- `CodPaidSummary`: แสดง `cod_reference` จากเช็คอิน หรือ qrPaymentId ที่บันทึกไว้ในเครื่อง; `CodCollectSection` แสดง payment_id ตอนจ่ายแล้ว
- `checkCodQr`: ส่งกลับ `payment_id` จากผลเช็คสถานะตอนจ่ายสำเร็จ และใช้ค่านี้เป็นเลขอ้างอิง
- `codClear.ts`: `CodClearRecord` เพิ่ม `clear_method`, `clear_reference`; `submitCodClear` รับ `clear_method?`, `clear_reference?`
- `ClearDialog`: แท็บ QR Mint ใช้ `createCodQr`/`checkCodQr` (reference `CLEAR-<order_number>`) และเก็บสถานะ payment_id กับสถานะจ่ายแล้วไว้ในเครื่อง ต่อเลขงาน เพื่อไม่ให้หายเมื่อปิดหน้าต่าง
- ข้อความรองรับ 4 ภาษา และเพิ่มเทสต์สำหรับ payload ของการเคลียร์ยอด
