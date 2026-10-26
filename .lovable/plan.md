# แท็บวิธีรับเงิน COD เริ่มตามงานทุกครั้งที่เปิด

## ปัญหา
กล่องเก็บเงินปลายทางจำแท็บที่เลือกไว้ครั้งก่อน เปิดใหม่จึงค้างอยู่แท็บเดิม แทนที่จะเริ่มตามวิธีที่งานกำหนด

## แก้ไข
- ทุกครั้งที่เปิดหน้าต่างจุดส่ง แท็บเริ่มต้นตามงาน:
  - งานเก็บเงินสด -> แท็บ "เงินสด"
  - งานเก็บด้วย QR -> แท็บ "QR Mint"
- ระหว่างเปิดอยู่ คนขับยังสลับแท็บได้ตามปกติ แต่ปิดแล้วเปิดใหม่จะกลับไปค่าเริ่มต้นของงาน
- ถ้าจ่ายผ่าน QR Mint สำเร็จแล้ว ให้คงแสดงแท็บ QR Mint (ไม่ให้สถานะจ่ายแล้วหาย)
- ไม่แตะรูปที่แนบ, ขั้นตอนเช็คอิน/POD หรือข้อมูลที่ส่งเข้าระบบ

## Technical details
- `CodCollectSection.tsx`: when restoring state from localStorage, drop the saved `method` (keep it only if `qrConfirmed` is true, forcing `mint_qr`), so `method` falls back to `cod.method` (qr -> mint_qr, else cash) on every mount.
