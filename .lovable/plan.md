# แท็บวิธีรับเงิน COD: เริ่มตามงาน, ล็อคเมื่อจ่าย Mint แล้ว, เตือนก่อนปิด

## แก้ไข
1. แท็บเริ่มต้นตามงานทุกครั้งที่เปิด
   - งานเงินสด -> "เงินสด", งาน QR -> "QR Mint"
   - ระหว่างเปิดอยู่สลับได้ แต่ปิดแล้วเปิดใหม่กลับไปค่าเริ่มต้นของงาน
2. จ่ายผ่าน QR Mint สำเร็จแล้ว
   - แสดงแท็บ QR Mint ค้างไว้พร้อมสถานะ "ชำระแล้ว" ทุกครั้งที่เปิดใหม่
   - ล็อคแท็บ เงินสด / QR โค้ก กดสลับไม่ได้
3. กันเผลอปิดหน้าต่างหลังจ่ายแล้ว
   - ถ้าจ่าย Mint แล้วแต่ยังไม่ได้ส่งหลักฐาน/ยืนยันจุดส่ง แล้วกดปิด (ปุ่ม X, แตะด้านนอก, ปุ่มย้อนกลับ) จะขึ้นแจ้งเตือน "ลูกค้าชำระแล้ว กรุณาแนบหลักฐานให้ครบก่อน" พร้อมปุ่ม "อยู่ต่อ" และ "ปิดไปก่อน"
   - ถ้าเลือกปิดไปก่อน ระบบยังจำสถานะไว้ครบ (จ่ายแล้ว, รูปที่แนบ, รูป POD ที่ถ่ายไว้) เปิดใหม่ทำต่อได้ทันที
4. จำค่าเดิมให้ครบทุกกรณี: รูปหลักฐาน COD และสถานะจ่าย Mint ยังอยู่หลังปิด/เปิดใหม่ (แก้ปัญหาที่บางครั้งค่าที่บันทึกถูกเขียนทับด้วยค่าว่างตอนเปิดหน้า)

ไม่เปลี่ยนขั้นตอนเช็คอิน/POD หรือข้อมูลที่ส่งเข้าระบบ

## Technical details
- `CodCollectSection.tsx`: on restore, drop saved `method` unless `qrConfirmed` (then force `mint_qr`); disable other tab buttons when `qrConfirmed`; re-read storage when `storageKey` changes and skip persisting that render.
- `DeliveryDetailPage.tsx`: stable COD storageKey from route delivery index; register a "close guard" while `codState.method==='mint_qr' && qrConfirmed` and step not yet submitted.
- `JobStepRoutes.tsx`: extend `StepModalContext` with `setCloseGuard(fn|null)`; Dialog `close()` checks the guard and shows an AlertDialog (stay / close anyway) before navigating back.
