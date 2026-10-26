# แสดงสรุปเก็บเงิน COD ในหน้าจุดส่งที่ทำเสร็จแล้ว

## แก้ไข
แสดงกล่อง "สรุปเก็บเงินปลายทาง (COD)" ใต้ส่วน "POD สำเร็จ" เฉพาะจุดที่มี COD:
- ยอดที่ต้องเก็บ: ฿xxx และวิธีที่งานกำหนด (เงินสด / QR)
- จ่ายจริง: ฿xxx ผ่าน เงินสด / QR Mint / QR โค้ก พร้อมเวลาที่รับเงิน
- รูปหลักฐานการรับเงิน (กดดูขยายได้) ถ้ามี
- 4 ภาษา

ไม่เปลี่ยนค่าที่ส่งเข้าระบบ หรือขั้นตอนเช็คอิน/POD

## Technical details
- `DeliveryDetailPage.tsx`: read the `checkin_type: 'payment'` record from the driver's check-ins (`payment_amount`, `cod_method`, `cod_proof_urls`, created time); fall back to the locally saved COD state (method, urls) when the record lacks those fields. Display accepts `cash`, `static_qr`/`qr_coke`, `mint_qr`/`qr_mint`.
- Proof photos via existing `usePresignedImageUrl`.
